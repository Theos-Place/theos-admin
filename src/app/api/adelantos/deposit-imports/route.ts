import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { esMesValido, nombreDelMes } from '@/lib/finance/adelantos'
import { filasDelExcel, emparejarSedes } from '@/lib/finance/presupuestos-de-sedes'
import { sedesOperativas, listarTipos, depositosDelMes, fijarDeposito } from '@/lib/supabase/queries/adelantos'
import { reportarError } from '@/lib/observabilidad'

/** La primera hoja como matriz de valores (ExcelJS numera desde 1). */
async function matrizDelArchivo(file: File): Promise<unknown[][]> {
  const buf = Buffer.from(await file.arrayBuffer())
  if (/\.csv$/i.test(file.name)) {
    const texto = buf.toString('utf8')
    // El separador se cuenta en TODO el archivo: la primera línea suele ser un
    // título sin separadores («Control octubre»), y con ella sola salía ','.
    const sep = (texto.match(/;/g)?.length ?? 0) >= (texto.match(/,/g)?.length ?? 0) ? ';' : ','
    return texto.split(/\r?\n/).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim()))
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const out: unknown[][] = []
  ws.eachRow({ includeEmpty: true }, row => {
    const valores = Array.isArray(row.values) ? row.values.slice(1) : []
    out.push(valores as unknown[])
  })
  return out
}

/**
 * FIN-16 · POST (multipart) — los depósitos del mes desde el Excel de control
 * de Andrés (nombre de sede + monto depositado). Campos: `file`, `mes`,
 * `tipo`, `aplicar` ('1' aplica; cualquier otra cosa es DRY-RUN).
 *
 * El dry-run dice qué leyó, con qué sede casó cada fila, qué cambia y qué no
 * se toca (sin sede, repetidas, meses cerrados). Recién al aplicar se escribe.
 */
export async function POST(req: NextRequest) {
  const auth = await requireModuleView('finanzas', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const form = await req.formData()
    const file = form.get('file')
    const mes = String(form.get('mes') ?? '')
    const tipo = String(form.get('tipo') ?? '')
    const aplicar = String(form.get('aplicar') ?? '') === '1'
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera 5 MB.' }, { status: 400 })
    if (!esMesValido(mes)) return NextResponse.json({ error: 'Mes inválido.' }, { status: 400 })
    const tipos = await listarTipos()
    if (!tipos.some(t => t.code === tipo)) return NextResponse.json({ error: 'Tipo de presupuesto desconocido.' }, { status: 400 })

    let matriz: unknown[][]
    try { matriz = await matrizDelArchivo(file) } catch {
      return NextResponse.json({ error: 'No se pudo leer el archivo. Subilo como .xlsx o .csv.' }, { status: 400 })
    }
    const filas = filasDelExcel(matriz)
    if (filas.length === 0) return NextResponse.json({ error: 'No encontré filas con sede y monto.' }, { status: 400 })

    const [sedes, actuales] = await Promise.all([sedesOperativas(), depositosDelMes(mes, tipo)])
    const emp = emparejarSedes(filas, sedes)
    const cambios = emp.coincidencias.map(c => {
      const actual = actuales[c.sede_code]
      const que = actual?.estado === 'cerrado' ? 'cerrado'
        : !actual ? 'abre'
        : actual.deposito === c.monto ? 'igual' : 'cambia'
      return { ...c, deposito_actual: actual?.deposito ?? null, que }
    })

    if (!aplicar) {
      return NextResponse.json({ mes, tipo, cambios, sin_sede: emp.sinSede, repetidas: emp.repetidas })
    }

    const resultado: Record<string, string> = {}
    for (const c of cambios) {
      if (c.que === 'cerrado' || c.que === 'igual') continue
      resultado[c.sede_code] = await fijarDeposito(c.sede_code, tipo, mes, c.monto)
    }
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'sede_advances',
      newData: { importacion: file.name, mes, tipo, depositos: cambios.map(c => ({ sede: c.sede_code, monto: c.monto, que: c.que })) },
    })
    const aplicados = Object.keys(resultado).length
    return NextResponse.json({
      ok: true, aplicados,
      mensaje: `${aplicados} sede${aplicados === 1 ? '' : 's'} con depósito de ${nombreDelMes(mes)} cargado.`,
    })
  } catch (error) {
    reportarError('POST /api/adelantos/deposit-imports:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

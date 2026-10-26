import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'

// GET: plantilla .xlsx para importar grupos de estudio (EST-2), con dropdowns
// de planes (códigos vivos) y zonas del catálogo. Mismo guard que importar.

const MAX_ROWS = 500
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export async function GET() {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const supabase = createAdminClient()
    const [{ data: plansData }, { data: sedesData }] = await Promise.all([
      supabase.from('study_plans').select('code').eq('is_active', true).not('code', 'is', null).order('code'),
      supabase.from('sedes').select('name').eq('is_active', true).order('name'),
    ])
    const planCodes = ((plansData ?? []) as Array<{ code: string }>).map(p => p.code)
    const zonas = ((sedesData ?? []) as Array<{ name: string | null }>).map(s => s.name).filter((n): n is string => !!n)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const ws = wb.addWorksheet('Grupos')
    ws.columns = [
      { header: 'Plan (código)', key: 'plan', width: 14 },
      { header: 'Zona / Sede', key: 'zona', width: 22 },
      { header: 'Día', key: 'dia', width: 14 },
      { header: 'Horario', key: 'horario', width: 12 },
      { header: 'Fecha inicio', key: 'fecha_inicio', width: 14 },
      { header: 'Fecha fin', key: 'fecha_fin', width: 14 },
      { header: 'Cupo', key: 'cupo', width: 8 },
      { header: 'Cédula del dirigente', key: 'cedula_dirigente', width: 20 },
      { header: 'Inicio de matrícula', key: 'inicio_matricula', width: 17 },
      { header: 'Fin de matrícula', key: 'fin_matricula', width: 16 },
    ]
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
    headerRow.alignment = { vertical: 'middle' }
    headerRow.height = 22
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    /**
     * LOS DESPLEGABLES (2026-10-26). Antes apuntaban a una hoja `veryHidden`
     * con una fórmula entre hojas, y a Ari (Estudios) no se le cargaban: Numbers,
     * Google Sheets, LibreOffice y el Excel de celular ignoran esa combinación,
     * mientras que el Excel de escritorio sí la lee. Ahora:
     *  · Lo que cabe en 255 caracteres va EN LÍNEA («"N1,N2,…"»), que lo
     *    entiende todo el mundo: planes y días siempre; zonas mientras quepan.
     *  · Lo que no cabe va a una hoja «Listas» normal (oculta, no veryHidden),
     *    con la referencia sin «=», que es la forma canónica de exceljs.
     *  · Una sola validación por COLUMNA (rango A2:A500) y no una por celda:
     *    1.500 validaciones sueltas también tumbaban a algún lector.
     */
    const LIMITE_EN_LINEA = 255
    const lists = wb.addWorksheet('Listas', { state: 'hidden' })
    let col = 0
    const formulaDe = (header: string, items: string[]): string => {
      const enLinea = `"${items.join(',')}"`
      if (enLinea.length <= LIMITE_EN_LINEA && !items.some(i => i.includes(',') || i.includes('"'))) return enLinea
      col += 1
      lists.getRow(1).getCell(col).value = header
      const used = items.length ? items : ['']
      used.forEach((v, i) => { lists.getRow(i + 2).getCell(col).value = v })
      const letter = lists.getColumn(col).letter
      return `Listas!$${letter}$2:$${letter}$${1 + used.length}`
    }
    const reglas: Array<[string, string]> = [
      ['A', formulaDe('PLANES', planCodes)],
      ['B', formulaDe('ZONAS', zonas)],
      ['C', formulaDe('DIAS', DIAS)],
    ]
    // `dataValidations.add` existe en exceljs (lib/doc/data-validations.js)
    // pero no está en sus tipos: se tipa acá.
    const validaciones = (ws as unknown as { dataValidations: { add: (rango: string, v: ExcelJS.DataValidation) => void } }).dataValidations
    for (const [columna, formula] of reglas) {
      validaciones.add(`${columna}2:${columna}${MAX_ROWS}`, {
        type: 'list', allowBlank: true, showErrorMessage: true,
        errorTitle: 'Valor fuera de la lista', error: 'Elegí una opción del desplegable.',
        formulae: [formula],
      })
    }
    // Si la hoja de listas quedó vacía (todo cupo en línea), no se deja una
    // pestaña oculta de más.
    if (col === 0) wb.removeWorksheet(lists.id)

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla-grupos.xlsx"',
      },
    })
  } catch (error) {
    reportarError('GET /api/studies/groups/import-template:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

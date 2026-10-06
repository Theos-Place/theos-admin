import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { reclasificacionesDelPeriodo } from '@/lib/supabase/queries/creditos'
import {
  resumirReclasificaciones, situacionDelCredito,
} from '@/lib/finance/reporte-de-reclasificaciones'
import { reportarError } from '@/lib/observabilidad'

/**
 * FIN-9 · El reporte de reclasificaciones, por mes o por año.
 *
 * `?anio=2026[&mes=10][&formato=xlsx]`. Lo pidió Meli para cuadrar contra
 * QuickBooks: cada crédito emitido es plata que entró en un rubro y va a
 * salir en otro, y sin el par completo los dos movimientos no se pueden
 * emparejar.
 *
 * El XLSX se AUDITA como export: se lleva nombres y montos de personas.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRoles('finanzas', 'direccion')
  if (auth.res) return auth.res
  try {
    const anio = Number(req.nextUrl.searchParams.get('anio'))
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json({ error: 'Indicá un año válido.' }, { status: 400 })
    }
    const mesRaw = req.nextUrl.searchParams.get('mes')
    const mes = mesRaw ? Number(mesRaw) : null
    if (mes !== null && (!Number.isInteger(mes) || mes < 1 || mes > 12)) {
      return NextResponse.json({ error: 'El mes va de 1 a 12.' }, { status: 400 })
    }

    const filas = await reclasificacionesDelPeriodo({ anio, mes })
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())

    if (req.nextUrl.searchParams.get('formato') !== 'xlsx') {
      return NextResponse.json({
        items: filas.map(f => ({ ...f, situacion: situacionDelCredito(f, hoy) })),
        resumen: resumirReclasificaciones(filas, hoy),
      })
    }

    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const h = wb.addWorksheet('Reclasificaciones')
    h.columns = [
      { header: 'Persona', key: 'persona', width: 32 },
      { header: 'Emitido', key: 'emitido', width: 12 },
      { header: 'Monto', key: 'monto', width: 12 },
      { header: 'Moneda', key: 'currency', width: 9 },
      { header: 'Rubro de origen', key: 'rubro_origen', width: 30 },
      { header: 'Pago de origen', key: 'pago_origen', width: 38 },
      { header: 'Motivo', key: 'motivo', width: 40 },
      { header: 'Situación', key: 'situacion', width: 18 },
      { header: 'Usado el', key: 'usado', width: 12 },
      { header: 'Rubro destino', key: 'rubro_destino', width: 30 },
      { header: 'Vence', key: 'vence', width: 12 },
    ]
    h.addRows(filas.map(f => ({ ...f, situacion: situacionDelCredito(f, hoy) })))
    h.getRow(1).font = { bold: true }
    // Las fechas como TEXTO: Excel reinterpreta YYYY-MM-DD según la
    // configuración regional de quien abre y aparecen días cambiados.
    for (const k of ['emitido', 'usado', 'vence']) h.getColumn(k).numFmt = '@'

    const resumen = resumirReclasificaciones(filas, hoy)
    const h2 = wb.addWorksheet('Totales')
    h2.columns = [
      { header: 'Moneda', key: 'currency', width: 10 },
      { header: 'Emitido', key: 'emitido', width: 14 },
      { header: 'Usado', key: 'usado', width: 14 },
      { header: 'Pendiente de usar', key: 'pendiente', width: 18 },
      { header: 'Vencido sin usar', key: 'vencido', width: 18 },
    ]
    h2.addRows(resumen.porMoneda)
    h2.getRow(1).font = { bold: true }

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'EXPORT',
      entityType: 'scholarships',
      entityId: null,
      newData: { reporte: 'reclasificaciones', anio, mes, filas: filas.length },
    })

    const buf = await wb.xlsx.writeBuffer()
    const nombre = `reclasificaciones-${anio}${mes ? `-${String(mes).padStart(2, '0')}` : ''}.xlsx`
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombre}"`,
      },
    })
  } catch (error) {
    reportarError('GET /api/finance/creditos/reclasificaciones:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

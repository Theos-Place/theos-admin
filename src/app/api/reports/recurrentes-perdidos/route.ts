import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireAccesoAReporte } from '@/lib/auth/guard'
import { getRecurrentesPerdidos } from '@/lib/supabase/queries/no-volvieron'
import { MINIMO_CHECKINS_RECURRENTE, MESES_SIN_VENIR } from '@/lib/reports/no-volvieron'
import { xlsxFileName } from '@/lib/forms/xlsx-export'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · REP-14 · Los recurrentes que ya no van.
 *
 * Gente con al menos 20 check-ins a charla en todo su histórico y sin venir
 * en los últimos 6 meses. Medido en producción el 2026-10-05: son 644
 * personas, y el peor año fue 2025 con 235.
 *
 * ACOTADO como Estudios (ver `acceso-por-reporte`): la lista trae teléfonos
 * y correos de 644 personas. El módulo `reportes` a secas no alcanza.
 *
 * `?export=1` devuelve el .xlsx y QUEDA EN AUDIT_LOG: una hoja con 644
 * nombres, teléfonos y correos sale del sistema, y «¿quién la bajó?» tiene
 * que poder contestarse. Mismo criterio que el export del padrón.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAccesoAReporte('recurrentes-perdidos')
    if (auth.res) return auth.res
    const { ctx } = auth

    const filas = await getRecurrentesPerdidos()

    if (req.nextUrl.searchParams.get('export') !== '1') {
      return NextResponse.json({
        minimoCheckins: MINIMO_CHECKINS_RECURRENTE,
        mesesSinVenir: MESES_SIN_VENIR,
        personas: filas,
      })
    }

    await logAudit({
      actorUserId: ctx.userId,
      action: 'EXPORT',
      entityType: 'report_recurrentes_perdidos',
      newData: { filas: filas.length },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const ws = wb.addWorksheet('Recurrentes perdidos')

    const COLUMNAS = [
      { header: 'Nombre', width: 30, get: (f: typeof filas[number]) => f.nombre },
      { header: 'Teléfono', width: 14, get: (f: typeof filas[number]) => f.telefono ?? '—' },
      { header: 'Correo', width: 30, get: (f: typeof filas[number]) => f.email ?? '—' },
      { header: 'Sede', width: 22, get: (f: typeof filas[number]) => f.sede },
      { header: 'Asistencias', width: 13, get: (f: typeof filas[number]) => f.totalAsistencias },
      { header: 'Último check-in', width: 16, get: (f: typeof filas[number]) => f.ultimoCheckin.slice(0, 10) },
      { header: 'Año en que dejó de ir', width: 20, get: (f: typeof filas[number]) => f.anioEnQueDejoDeIr ?? '—' },
      { header: 'Años en que asistió', width: 22, get: (f: typeof filas[number]) => f.anios.join(', ') },
      { header: 'Llevó estudio', width: 14, get: (f: typeof filas[number]) => (f.llevoEstudio ? 'Sí' : 'No') },
      { header: 'Último estudio', width: 24, get: (f: typeof filas[number]) => f.ultimoEstudio ?? '—' },
      { header: 'Dirigente', width: 26, get: (f: typeof filas[number]) => f.dirigente ?? '—' },
    ]
    ws.columns = COLUMNAS.map(c => ({ header: c.header, width: c.width }))

    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
    head.alignment = { vertical: 'middle', wrapText: true }
    head.height = 28
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } }
    // El teléfono como TEXTO: si no, Excel se come el cero de adelante.
    ws.getColumn(2).numFmt = '@'
    ws.getColumn(6).numFmt = '@'

    for (const f of filas) ws.addRow(COLUMNAS.map(c => c.get(f)))

    ws.addRow([])
    ws.addRow([
      `${filas.length} personas con ${MINIMO_CHECKINS_RECURRENTE}+ asistencias a charla `
      + `y sin venir en ${MESES_SIN_VENIR} meses.`,
    ]).font = { italic: true }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFileName('Recurrentes que dejaron de venir')}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    reportarError('GET /api/reports/recurrentes-perdidos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

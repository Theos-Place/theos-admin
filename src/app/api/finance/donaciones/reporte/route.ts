import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireRoles } from '@/lib/auth/guard'
import { getDonacionesParaReporte } from '@/lib/supabase/queries/finance'
import {
  construirReporteDeDonantes, totalesEnTexto, SIN_SEDE,
} from '@/lib/finance/reporte-de-donantes'
import { formatMoney } from '@/lib/format'
import { xlsxFileName } from '@/lib/forms/xlsx-export'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · DON-3 parte B · Donantes y montos, por período y por sede.
 *
 * QUIÉN: finanzas, dirección y admin. Los montos de donación son
 * confidenciales, y por eso este reporte vive en /finanzas y NO en /reportes
 * —que lo abren roles de métricas—. Es el mismo criterio que el resto del
 * módulo (`FinanceGuard` en la pantalla, estos roles en el endpoint).
 *
 * `?export=1` devuelve el .xlsx y QUEDA EN AUDIT_LOG: una hoja con nombres de
 * sede y montos de donación sale del sistema.
 */
const ROLES = ['finanzas', 'direccion', 'admin'] as const

const YMD = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles(...ROLES)
    if (auth.res) return auth.res

    const sp = req.nextUrl.searchParams
    const desde = sp.get('desde')
    const hasta = sp.get('hasta')
    const filtros = {
      desde: desde && YMD.test(desde) ? desde : null,
      hasta: hasta && YMD.test(hasta) ? hasta : null,
    }

    const filas = await getDonacionesParaReporte(filtros)
    const reporte = construirReporteDeDonantes(filas)

    if (sp.get('export') !== '1') {
      return NextResponse.json({ ...reporte, desde: filtros.desde, hasta: filtros.hasta })
    }

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'EXPORT',
      entityType: 'donations_report',
      newData: {
        donaciones: reporte.total.donaciones,
        donantes: reporte.total.donantes,
        desde: filtros.desde, hasta: filtros.hasta,
      },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const dinero = (m: number, c: string) => formatMoney(m, c)

    /** Encabezado con el estilo de la casa, igual en las tres hojas. */
    const encabezar = (ws: ExcelJS.Worksheet, cols: Array<{ header: string; width: number }>) => {
      ws.columns = cols
      const h = ws.getRow(1)
      h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
      h.alignment = { vertical: 'middle', wrapText: true }
      h.height = 26
      ws.views = [{ state: 'frozen', ySplit: 1 }]
    }

    const porAnio = wb.addWorksheet('Por año')
    encabezar(porAnio, [
      { header: 'Año', width: 10 }, { header: 'Donantes', width: 12 },
      { header: 'Donaciones', width: 13 }, { header: 'Totales', width: 30 },
      { header: 'Sin monto', width: 12 },
    ])
    for (const a of reporte.porAnio) {
      porAnio.addRow([a.periodo, a.donantes, a.donaciones, totalesEnTexto(a.totales, dinero) || '—', a.sinMonto])
    }

    const porMes = wb.addWorksheet('Por mes')
    encabezar(porMes, [
      { header: 'Mes', width: 12 }, { header: 'Donantes', width: 12 },
      { header: 'Donaciones', width: 13 }, { header: 'Totales', width: 30 },
      { header: 'Sin monto', width: 12 },
    ])
    for (const m of reporte.porMes) {
      porMes.addRow([m.periodo, m.donantes, m.donaciones, totalesEnTexto(m.totales, dinero) || '—', m.sinMonto])
    }

    const porSede = wb.addWorksheet('Por sede')
    encabezar(porSede, [
      { header: 'Sede del donante', width: 28 }, { header: 'Donantes', width: 12 },
      { header: 'Donaciones', width: 13 }, { header: 'Totales', width: 30 },
      { header: 'Sin monto', width: 12 },
    ])
    for (const s of reporte.porSede) {
      porSede.addRow([s.sede, s.donantes, s.donaciones, totalesEnTexto(s.totales, dinero) || '—', s.sinMonto])
    }
    porSede.addRow([])
    porSede.addRow([
      `«${SIN_SEDE}» son donantes sin asistencias registradas: la sede se calcula de los check-ins.`,
    ]).font = { italic: true }

    // Las advertencias van en la hoja, no solo en la pantalla: el archivo se
    // reenvía por correo y viaja sin su contexto.
    for (const ws of [porAnio, porMes, porSede]) {
      ws.addRow([])
      ws.addRow([
        'Los totales van POR MONEDA y no se suman entre sí. Los DONANTES de cada fila '
        + 'son personas únicas de esa fila: no suman el total, porque alguien que donó '
        + 'en dos meses cuenta en los dos.',
      ]).font = { italic: true }
      if (!reporte.hayMontos) {
        ws.addRow([
          'ATENCIÓN: ninguna donación del rango tiene monto registrado. Los importes '
          + 'están pendientes de importar (DON-3 parte A); los conteos de personas sí '
          + 'son reales.',
        ]).font = { bold: true, color: { argb: 'FFC43635' } }
      }
    }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFileName('Donantes y montos')}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    reportarError('GET /api/finance/donaciones/reporte:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

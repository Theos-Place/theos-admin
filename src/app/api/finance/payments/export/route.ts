import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireModuleView } from '@/lib/auth/guard'
import { getPaymentsPage, type PaymentFilters } from '@/lib/supabase/queries/finance'
import { toDomainPayment } from '@/lib/finance/adapter'
import {
  filasDeConciliacion, resumenDeConciliacion, type PagoParaConciliar,
} from '@/lib/finance/filas-de-conciliacion'
import { xlsxFileName } from '@/lib/forms/xlsx-export'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * PAG-6 · GET: los pagos del filtro actual en .xlsx, para conciliar.
 *
 * EL CASO: Andrés registra una línea del estado de cuenta —«el depósito del
 * lunes y martes»— y necesita el detalle exacto de los pagos que la forman.
 * Por eso el export respeta LOS MISMOS filtros que la pantalla: lo que se
 * baja es lo que se está viendo, no «todos los pagos».
 *
 * GATE: el mismo `requireModuleView(['finanzas','revision_pagos'])` del GET
 * que esta hoja exporta. No se endurece acá: quien ya puede VER la lista con
 * sus montos en pantalla no gana nada nuevo bajándola, y endurecerlo dejaría
 * a los roles de revisión mirando una lista que no pueden exportar.
 *
 * SÍ queda REGISTRADO en audit_log, como el export del padrón: una hoja con
 * nombres y montos sale del sistema, y «¿quién bajó los pagos de setiembre?»
 * tiene que poder contestarse.
 *
 * Va como ruta y no en el cliente porque ExcelJS no cabe en el bundle de una
 * pantalla (mismo criterio que el export de formularios y el de asistentes).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView(['finanzas', 'revision_pagos'])
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl

    const entity = searchParams.get('entity_type')
    const currency = searchParams.get('currency')
    const filters: PaymentFilters = {
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      method: searchParams.get('method') ?? undefined,
      entity_type: entity === 'event' || entity === 'study_group' ? entity : undefined,
      currency: currency === 'CRC' || currency === 'USD' || currency === 'EUR' ? currency : undefined,
      inPaymentPlan: searchParams.get('in_plan') === '1' || undefined,
      paidFrom: searchParams.get('paid_from') ?? undefined,
      paidTo: searchParams.get('paid_to') ?? undefined,
      // Sin paginar: la hoja es del RESULTADO del filtro, no de la página que
      // quedó abierta. Bajar 25 filas rotuladas «los pagos de setiembre»
      // sería peor que no tener export.
      all: true,
    }

    const { rows } = await getPaymentsPage(filters)
    const pagos: PagoParaConciliar[] = rows.map(toDomainPayment).map(p => ({
      member_name: p.member_name,
      entity_name: p.entity_name,
      concept: p.description_label ?? p.kind_label ?? p.concept ?? null,
      amount: p.amount,
      currency: p.currency,
      paid_at: p.paid_at,
    }))
    const filas = filasDeConciliacion(pagos)

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'EXPORT',
      entityType: 'payments',
      newData: {
        filas: filas.length,
        desde: filters.paidFrom ?? null,
        hasta: filters.paidTo ?? null,
        estado: filters.status ?? null,
      },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const ws = wb.addWorksheet('Pagos')

    const COLUMNAS: Array<{ header: string; width: number; key: keyof (typeof filas)[number] }> = [
      { header: 'Nombre', width: 30, key: 'nombre' },
      { header: 'Actividad', width: 34, key: 'actividad' },
      { header: 'Concepto', width: 22, key: 'concepto' },
      { header: 'Monto', width: 14, key: 'monto' },
      { header: 'Moneda', width: 10, key: 'moneda' },
      { header: 'Fecha de pago', width: 20, key: 'fecha_de_pago' },
    ]
    ws.columns = COLUMNAS.map(c => ({ header: c.header, width: c.width }))

    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
    head.alignment = { vertical: 'middle', wrapText: true }
    head.height = 26
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } }

    // El monto con separador de miles y dos decimales, pero SIN símbolo: la
    // moneda va en su propia columna justamente porque la hoja puede traer
    // colones y dólares, y un símbolo fijo mentiría en la mitad de las filas.
    ws.getColumn(4).numFmt = '#,##0.00'
    // La fecha como TEXTO: ya viene escrita en día de Costa Rica, y dejar que
    // Excel la reinterprete como fecha la devolvería a la zona de la máquina
    // de quien abre el archivo — que es exactamente el error que se evitó.
    ws.getColumn(6).numFmt = '@'

    for (const f of filas) ws.addRow(COLUMNAS.map(c => f[c.key]))

    // El resumen al pie, con un total POR MONEDA (INT-3): un total único que
    // mezcle colones y dólares no es un número, es un error con apariencia
    // de número — y en una conciliación contra el banco se propaga.
    ws.addRow([])
    ws.addRow([resumenDeConciliacion(filas)]).font = { italic: true }
    if (filters.paidFrom || filters.paidTo) {
      ws.addRow([`Fecha de pago entre ${filters.paidFrom ?? 'el inicio'} y ${filters.paidTo ?? 'hoy'} (días de Costa Rica)`])
        .font = { italic: true }
    }

    const buf = await wb.xlsx.writeBuffer()
    const rotulo = filters.paidFrom || filters.paidTo
      ? `Pagos ${filters.paidFrom ?? ''} a ${filters.paidTo ?? ''}`.trim()
      : 'Pagos'
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFileName(rotulo)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    reportarError('GET /api/finance/payments/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

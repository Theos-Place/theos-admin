/**
 * FIN-12/FIN-16 · El Excel de presupuestos de sedes para Andrés: todas las facturas de un mes,
 * una fila por factura con su sede, para asociarlas en contabilidad. Mismo
 * patrón que `export-de-dirigentes`: UN archivo, hoja por sede más un
 * resumen.
 */
import ExcelJS from 'exceljs'
import type { AdelantoFila } from '@/lib/supabase/queries/adelantos'

const ENCABEZADOS = ['Sede', 'Tipo', 'Mes', 'Semana (charla)', 'Encargado', 'Fecha', 'Proveedor', 'N° factura', 'Monto', 'Estado', 'Observaciones', 'Comprobante'] as const

export async function construirExcelDeAdelantos(adelantos: readonly AdelantoFila[], mes: string, ahora = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Theos Place'; wb.created = ahora

  const resumen = wb.addWorksheet('Resumen')
  // FIN-16 · Tipo de presupuesto, y el disponible partido en saldo anterior + depósito.
  resumen.addRow(['Sede', 'Tipo', 'Mes', 'Saldo mes anterior', 'Depósito del mes', 'Disponible', 'Gastado', 'Pendiente', 'Saldo', 'Sobregiro', 'Estado', 'Saldo final (al cerrar)'])
  resumen.getRow(1).font = { bold: true }
  for (const a of adelantos) {
    resumen.addRow([a.sede_name, a.tipo_nombre, a.mes, a.saldo_anterior, a.deposito, a.presupuesto, a.saldo.gastado, a.saldo.pendiente, a.saldo.restante, a.saldo.sobregiro ? 'SÍ' : '', a.estado, a.saldo_final ?? ''])
  }

  const todas = wb.addWorksheet('Facturas')
  todas.addRow([...ENCABEZADOS]); todas.getRow(1).font = { bold: true }
  todas.views = [{ state: 'frozen', ySplit: 1 }]
  for (const a of adelantos) for (const f of a.facturas) {
    todas.addRow([a.sede_name, a.tipo_nombre, mes, f.semana, f.encargado ?? '', f.fecha, f.proveedor, f.numero_factura ?? '', f.monto, f.estado, f.observaciones ?? '', f.receipt_path ? 'Sí' : 'No'])
  }
  for (const hoja of [resumen, todas]) hoja.columns.forEach(c => { c.width = 18 })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

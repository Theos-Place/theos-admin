import { ymdCR } from '@/lib/format'

/**
 * Baja un .xlsx armado en el navegador con lo que la pantalla ya tiene cargado.
 *
 * Para las pantallas de finanzas que traen la lista COMPLETA (devoluciones,
 * saldos a favor): no hace falta un endpoint aparte, y lo que se baja es
 * exactamente lo que se está viendo con los filtros puestos. ExcelJS se
 * importa al hacer clic para no cargarlo en cada visita.
 */
export async function descargarExcel(
  nombre: string,
  encabezados: readonly string[],
  filas: ReadonlyArray<ReadonlyArray<string | number | null>>,
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Theos Place'
  const hoja = wb.addWorksheet('Hoja 1')
  hoja.addRow([...encabezados])
  hoja.getRow(1).font = { bold: true }
  hoja.views = [{ state: 'frozen', ySplit: 1 }]
  for (const f of filas) hoja.addRow(f.map(v => v ?? ''))
  hoja.columns.forEach(c => { c.width = 20 })
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre}-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

/** ¿La fecha ISO cae en el rango [desde, hasta] (YYYY-MM-DD, días de Costa Rica)? Vacío = sin límite. */
export function enRango(iso: string | null | undefined, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true
  if (!iso) return false
  const dia = ymdCR(new Date(iso))
  return (!desde || dia >= desde) && (!hasta || dia <= hasta)
}

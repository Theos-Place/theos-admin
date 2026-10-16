/**
 * EST-29 · La demanda declarada en Excel: una hoja con los clústeres y otra
 * con cada persona, para trabajar la apertura fuera de la pantalla.
 */
import ExcelJS from 'exceljs'
import { ETIQUETA_FUENTE, etiquetaDeZona, type Cluster } from '@/lib/studies/demanda-declarada'

type ClusterParaExcel = Cluster & { dirigentes: Array<{ nombre: string }> }

export async function construirExcelDeDemanda(
  clusters: readonly ClusterParaExcel[],
  nombres: { planes: Record<string, string>; zonas: Record<string, string> },
  ahora: Date = new Date(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Theos Place'
  wb.created = ahora

  const resumen = wb.addWorksheet('Clústeres')
  resumen.addRow(['Estudio', 'Zona', 'Personas', 'Se puede abrir', 'Días más pedidos', 'Franja', 'Dirigentes disponibles', 'Cuáles'])
  for (const c of clusters) {
    resumen.addRow([
      nombres.planes[c.planCode] ?? c.planCode, etiquetaDeZona(c.zona, nombres.zonas), c.personas.length,
      c.accionable ? 'Sí' : 'No', c.diasMasPedidos.join(', '), c.franjaMasPedida ?? '',
      c.dirigentes.length, c.dirigentes.map(d => d.nombre).join(', '),
    ])
  }
  const personas = wb.addWorksheet('Personas')
  personas.addRow(['Estudio', 'Zona', 'Persona', 'Correo', 'Teléfono', 'Pidió', 'Días', 'Franja', 'Lugar escrito', 'Fecha', 'Estado'])
  for (const c of clusters) for (const p of c.personas) {
    personas.addRow([
      nombres.planes[c.planCode] ?? c.planCode, etiquetaDeZona(c.zona, nombres.zonas), p.nombre, p.email ?? '', p.telefono ?? '',
      ETIQUETA_FUENTE[p.fuente], p.dias.join(', '), p.franja ?? '', p.zonaTexto ?? '', p.creada.slice(0, 10), p.estado,
    ])
  }
  for (const [hoja, anchos] of [[resumen, [28, 20, 10, 14, 22, 10, 12, 50]], [personas, [24, 20, 30, 30, 14, 22, 20, 10, 30, 12, 12]]] as const) {
    hoja.getRow(1).font = { bold: true }
    hoja.views = [{ state: 'frozen', ySplit: 1 }]
    hoja.columns.forEach((col, i) => { col.width = anchos[i] ?? 12 })
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, hoja.rowCount), column: hoja.columnCount } }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

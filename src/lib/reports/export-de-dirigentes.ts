import ExcelJS from 'exceljs'
import {
  ETIQUETA_RAZON_INACTIVO, ETIQUETA_NO_DISPONIBLE, ETIQUETA_DETALLE,
  type RazonInactivo, type RazonNoDisponible, type DetalleNoEjerce,
} from '@/lib/leaders/estado-del-dirigente'

/**
 * DIR-9 · El export del reporte de dirigentes.
 *
 * UN SOLO ARCHIVO, no uno por número. El reporte tiene quince celdas
 * clicables y hacer un endpoint para cada una daría quince archivos que no
 * se pueden cruzar entre sí. Acá va una fila por dirigente con las columnas
 * que DEFINEN cada celda —estado, disponibilidad, razón, sede, formación—,
 * así que «los 8 en pasantía» es filtrar una columna, y «los de Liberia
 * formados en Panorama» —que ninguna celda del reporte muestra— también.
 *
 * Las razones van con su ETIQUETA y no con el código: el archivo lo abre
 * quien reparte grupos, no quien escribió el enum.
 */
export type DirigenteParaExcel = {
  nombre: string
  sede: string | null
  estadoBase: string | null
  disponibilidad: string | null
  razonNoDisponible: string | null
  razonInactivo: string | null
  /** Derivada: tiene un grupo abierto que lo ocupa. */
  dirigiendo: boolean
  detalleNoEjerce: string | null
  formacion: readonly string[]
}

const ENCABEZADOS = [
  'Nombre', 'Sede', 'Estado', 'Disponibilidad', 'Por qué no disponible',
  'Dirigiendo ahora', 'Por qué inactivo', 'Detalle', 'Formación',
] as const

const etiqueta = <T extends string>(
  mapa: Record<T, string>, v: string | null,
): string => (v ? mapa[v as T] ?? v : '')

function fila(d: DirigenteParaExcel): (string | number)[] {
  return [
    d.nombre,
    // Vacío y no «Sin sede»: en Excel el filtro de vacíos ya existe y una
    // etiqueta inventada se ordena entre las sedes reales.
    d.sede ?? '',
    d.estadoBase === 'activo' ? 'Activo' : d.estadoBase === 'inactivo' ? 'Inactivo' : '',
    d.disponibilidad === 'disponible' ? 'Disponible'
      : d.disponibilidad === 'no_disponible' ? 'No disponible' : '',
    etiqueta(ETIQUETA_NO_DISPONIBLE, d.razonNoDisponible as RazonNoDisponible | null),
    d.dirigiendo ? 'Sí' : '',
    etiqueta(ETIQUETA_RAZON_INACTIVO, d.razonInactivo as RazonInactivo | null),
    etiqueta(ETIQUETA_DETALLE, d.detalleNoEjerce as DetalleNoEjerce | null),
    [...d.formacion].sort().join(', '),
  ]
}

export async function construirExcelDeDirigentes(
  gente: readonly DirigenteParaExcel[],
  ahora: Date = new Date(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Theos Place'
  wb.created = ahora

  const hoja = wb.addWorksheet('Dirigentes')
  hoja.addRow([...ENCABEZADOS])
  hoja.getRow(1).font = { bold: true }
  hoja.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]

  // Activos primero y, dentro, los disponibles: el archivo se abre para
  // buscar a quién asignarle un grupo.
  const peso = (d: DirigenteParaExcel) =>
    (d.estadoBase === 'activo' ? 0 : 2) + (d.disponibilidad === 'disponible' && !d.dirigiendo ? 0 : 1)
  const ordenada = [...gente].sort((a, b) =>
    peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, 'es'))
  for (const d of ordenada) hoja.addRow(fila(d))

  const anchos = [28, 24, 10, 16, 22, 16, 22, 24, 40]
  hoja.columns.forEach((col, i) => { col.width = anchos[i] ?? 12 })

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, ordenada.length + 1), column: ENCABEZADOS.length },
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}

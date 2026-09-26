import ExcelJS from 'exceljs'

/**
 * SRV-12 · El Excel de los puestos solicitados.
 *
 * PARA QUÉ. Los primeros de cada mes, quien recibe las solicitudes revisa lo
 * que pidieron los comités antes de publicarlo. Ese repaso se hace fuera del
 * sistema —se comparte, se comenta, se marca— y por eso es un archivo y no
 * solo una pantalla.
 *
 * LLEVA LAS DEFINICIONES DEL PUESTO, no solo el nombre y la cantidad. Es lo
 * que se pidió, y tiene razón de ser: quien publica necesita leer la
 * descripción y las funciones para decidir si el puesto está listo para salir
 * a la calle. Sin eso habría que abrir el catálogo puesto por puesto.
 *
 * EL ENCARGADO QUE LO PIDIÓ va en su columna. Un comité puede tener varios
 * encargados (Matrimonios tiene 4), así que van todos separados por coma: con
 * uno solo, la fila señalaría a quien no fue.
 *
 * Módulo PURO: recibe los datos ya leídos y devuelve el archivo. Está aparte
 * de la ruta para poder generarlo en un test y ABRIRLO — de un .xlsx, que el
 * código compile no dice nada.
 */

export type SolicitudParaExportar = {
  id: string
  comite: string
  /** Los encargados del comité, ya resueltos. */
  encargados: string[]
  puesto: string
  cupos: number
  estado: string
  solicitada: string
  /** Del catálogo del puesto: lo que hace falta para decidir si sale. */
  descripcion: string | null
  funciones: string | null
  perfil: string | null
  habilidades: string | null
  estudio_requerido: string | null
  ubicacion: string | null
}

export const ENCABEZADOS = [
  'Comité', 'Encargado(s)', 'Puesto', 'Cupos', 'Estado', 'Solicitada',
  'Descripción', 'Funciones', 'Perfil', 'Habilidades', 'Estudio requerido', 'Ubicación',
] as const

export function filaDeSolicitud(s: SolicitudParaExportar): Array<string | number> {
  return [
    s.comite,
    // Vacío y no «—»: una celda vacía se filtra y se cuenta; un guion es texto
    // que hay que acordarse de ignorar.
    s.encargados.join(', '),
    s.puesto,
    s.cupos,
    s.estado,
    s.solicitada.slice(0, 10),
    s.descripcion ?? '',
    s.funciones ?? '',
    s.perfil ?? '',
    s.habilidades ?? '',
    s.estudio_requerido ?? '',
    s.ubicacion ?? '',
  ]
}

export async function construirExcelDeSolicitudes(
  solicitudes: readonly SolicitudParaExportar[],
  ahora: Date = new Date(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Theos Place'
  wb.created = ahora

  const hoja = wb.addWorksheet('Solicitudes')
  hoja.addRow([...ENCABEZADOS])
  hoja.getRow(1).font = { bold: true }
  hoja.views = [{ state: 'frozen', ySplit: 1 }]

  // POR COMITÉ y dentro por puesto: el repaso se hace comité por comité, que
  // es como está organizada la conversación con los encargados.
  const ordenadas = [...solicitudes].sort((a, b) =>
    a.comite.localeCompare(b.comite, 'es') || a.puesto.localeCompare(b.puesto, 'es'))
  for (const s of ordenadas) hoja.addRow(filaDeSolicitud(s))

  const anchos = [26, 28, 30, 8, 14, 12, 42, 42, 32, 28, 22, 20]
  hoja.columns.forEach((col, i) => { col.width = anchos[i] ?? 18 })
  // Las columnas largas ajustan el texto: sin esto la descripción se sale por
  // encima de las de al lado y la hoja no se puede leer.
  for (const i of [7, 8, 9, 10]) {
    hoja.getColumn(i).alignment = { wrapText: true, vertical: 'top' }
  }

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, ordenadas.length + 1), column: ENCABEZADOS.length },
  }

  // Un total al pie: la pregunta del mes es «cuántos cupos salen», y sumarlos
  // a mano sobre 40 filas es la clase de cuenta que sale mal una vez al año.
  if (ordenadas.length > 0) {
    const fila = hoja.addRow(['TOTAL', '', '', ordenadas.reduce((s, x) => s + x.cupos, 0)])
    fila.font = { bold: true }
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}

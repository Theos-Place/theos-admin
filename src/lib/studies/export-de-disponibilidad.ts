import ExcelJS from 'exceljs'
import {
  DIAS, FRANJAS, DIA_LABEL, slot, textoDelRango,
  estadoDeConfirmacion, CONFIRMACION_LABEL, type EstadoDeConfirmacion,
} from '@/lib/studies/disponibilidad-de-dirigente'

/**
 * SRV-9 · El Excel de disponibilidades para el comité.
 *
 * PARA QUÉ. Las campañas de actualización son tres veces al año (marzo, julio,
 * noviembre) y lo primero que hay que saber es a quién volver a buscar. Hoy
 * eso no se puede preguntar: la disponibilidad vivía en hojas sueltas y no
 * había fecha de confirmación.
 *
 * LA COLUMNA QUE ORDENA TODO ES «Confirmación», y tiene TRES valores, no dos.
 * «Nunca confirmó» es alguien a quien nunca se le preguntó —hoy son las 505
 * fichas— y «Desactualizada» es alguien que dejó de contestar. Se buscan
 * distinto: al primero se le explica qué es esto, al segundo se le insiste.
 *
 * UNA COLUMNA POR FRANJA Y NO UNA CELDA CON TODO. Son 21 columnas, que se ve
 * ancho, pero es lo que hace que el archivo se pueda FILTRAR: la pregunta real
 * del comité es «¿quién puede los martes en la noche?», y con una celda que
 * diga «L-mañana, X-noche, V-tarde» eso se contesta leyendo a ojo.
 *
 * Módulo PURO: recibe los datos ya leídos y devuelve el archivo. Está aparte de
 * la ruta para poder generarlo en un test y ABRIRLO — de un .xlsx, que el
 * código compile no dice nada.
 */

export type DirigenteParaExportar = {
  member_id: string
  nombre: string
  correo: string | null
  telefono: string | null
  is_active: boolean
  availability_status: string
  /** Lo que el comité certificó. */
  formacion: string[]
  /** Lo que la persona dijo que quiere dar. */
  disponible: string[]
  /** Lo que la persona dijo que quiere APRENDER a dar. No habilita nada. */
  interesado: string[]
  zonas: string[]
  slots: string[]
  presta_casa: boolean
  suplente: boolean
  desde: string | null
  hasta: string | null
  folletos: string | null
  confirmado_at: string | null
}

const ENCABEZADO_FIJO = [
  'Nombre', 'Correo', 'Teléfono', 'Confirmación', 'Última confirmación',
  'Activo', 'Estado', 'Capacitado para', 'Quiere dar', 'Quiere aprender',
  'Zonas', 'Presta casa', 'Suplente', 'Ventana del año', 'Folletos',
] as const

/** Las 21 columnas de día × franja, en el mismo orden canónico que los slots. */
const ENCABEZADO_SLOTS = DIAS.flatMap(d => FRANJAS.map(f => `${DIA_LABEL[d]} ${f}`))

export function encabezados(): string[] {
  return [...ENCABEZADO_FIJO, ...ENCABEZADO_SLOTS]
}

/** La fila de una persona, en el mismo orden que `encabezados()`. */
export function filaDeDirigente(d: DirigenteParaExportar, ahora: Date): Array<string | number> {
  const estado: EstadoDeConfirmacion = estadoDeConfirmacion(d.confirmado_at, ahora)
  const fijas: Array<string | number> = [
    d.nombre,
    d.correo ?? '',
    d.telefono ?? '',
    CONFIRMACION_LABEL[estado],
    d.confirmado_at ? d.confirmado_at.slice(0, 10) : '',
    d.is_active ? 'Sí' : 'No',
    d.availability_status,
    d.formacion.join(', '),
    d.disponible.join(', '),
    d.interesado.join(', '),
    d.zonas.join(', '),
    d.presta_casa ? 'Sí' : 'No',
    d.suplente ? 'Sí' : 'No',
    textoDelRango(d.desde, d.hasta),
    d.folletos ?? '',
  ]
  // 'Sí' / '' y no true/false: en Excel un booleano se filtra peor que un
  // texto, y la columna vacía se lee de un vistazo como «no puede».
  const porSlot = DIAS.flatMap(dia => FRANJAS.map(f => (d.slots.includes(slot(dia, f)) ? 'Sí' : '')))
  return [...fijas, ...porSlot]
}

export async function construirExcelDeDisponibilidad(
  gente: readonly DirigenteParaExportar[],
  ahora: Date = new Date(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Theos Place'
  wb.created = ahora

  const hoja = wb.addWorksheet('Disponibilidad')
  hoja.addRow(encabezados())
  hoja.getRow(1).font = { bold: true }
  // Congelar la fila de títulos Y la primera columna: con 36 columnas, al
  // llegar al viernes ya no se sabe de quién es la fila.
  hoja.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]

  // Los pendientes ARRIBA. El archivo se abre para saber a quién buscar, no
  // para leerlo en orden alfabético: quien nunca confirmó va primero, después
  // el desactualizado, y de últimos los que ya están al día.
  const peso: Record<EstadoDeConfirmacion, number> = { nunca: 0, vencida: 1, vigente: 2 }
  const ordenada = [...gente].sort((a, b) => {
    const pa = peso[estadoDeConfirmacion(a.confirmado_at, ahora)]
    const pb = peso[estadoDeConfirmacion(b.confirmado_at, ahora)]
    return pa !== pb ? pa - pb : a.nombre.localeCompare(b.nombre, 'es')
  })
  for (const d of ordenada) hoja.addRow(filaDeDirigente(d, ahora))

  // Anchos: las de texto largo necesitan aire; las 21 de franja son 'Sí' o
  // nada y con 4 alcanzan.
  const anchos = [26, 26, 14, 16, 18, 8, 13, 24, 24, 24, 20, 12, 10, 20, 20]
  hoja.columns.forEach((col, i) => { col.width = anchos[i] ?? 5 })

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, ordenada.length + 1), column: encabezados().length },
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

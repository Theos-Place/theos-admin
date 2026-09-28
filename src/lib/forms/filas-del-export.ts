/**
 * FRM-6b · Los encabezados y las filas del export de respuestas, UNA sola vez.
 *
 * POR QUÉ ESTE MÓDULO EXISTE. Había dos exports que debían decir lo mismo y no
 * compartían una línea de código: el CSV se armaba en la pantalla y el XLSX en
 * la ruta. Se separaron TRES veces, y cada una la encontró alguien usándolos:
 *
 *   1. El CSV descartaba solo `section`, así que traía columnas siempre vacías
 *      de `info`, `page_break` y del bloque de datos personales.
 *   2. El CSV escribía el PATH del adjunto en vez del link que lo abre.
 *   3. FRM-6 le agregó al XLSX las columnas de la ficha y el CSV se quedó sin
 *      ellas — reportado por Floriana el 2026-09-28.
 *
 * Y en sentido contrario el CSV tenía «Grupo» y «Dirigente», que el XLSX nunca
 * tuvo. O sea que ninguno de los dos era «el bueno».
 *
 * Un comentario que diga «mismas columnas que el otro» no impide la cuarta vez.
 * Esto sí: los dos formatos llaman a `columnasDelExport` y a `filaDeRespuesta`,
 * y lo único que cambia entre ellos es cómo se escribe la celda.
 *
 * Módulo PURO: recibe los datos ya leídos y devuelve texto y valores.
 */

import { encabezadoDeCampo } from './computed-fields'
import { isDataField, excelCellKind, answerToCell, type CellKind } from './xlsx-export'
import { esPathDeAdjunto, urlDeAdjunto } from './attachment'
import { COLUMNAS_PERSONALES, celdasPersonales, type FichaParaExport } from './datos-personales-del-export'
import { formatPhoneCR } from '@/lib/phone'

export type CampoDelExport = { id: string; field_type: string; label: string | null }

export type RespuestaParaExport = {
  member_id: string | null
  member_name: string
  member_phone: string | null
  recorded_by_name: string
  submitted_at: string | null
  /** RET-1 · Solo en los formularios atados a un grupo (la encuesta). */
  grupo?: string | null
  dirigente?: string | null
  /** El valor por id de campo. */
  answers: Record<string, unknown>
}

export type ColumnaDelExport = {
  header: string
  kind: CellKind
  /** Ancho sugerido para el XLSX; el CSV lo ignora. */
  width: number
}

/**
 * Las columnas, en el orden en que se leen.
 *
 * `conGrupo` se decide por los DATOS y no por el tipo de formulario (RET-1):
 * agregar «Grupo» y «Dirigente» siempre metería dos columnas vacías en el
 * export de todos los formularios, y un archivo con columnas que nunca traen
 * nada se lee como un error.
 */
export function columnasDelExport(
  campos: readonly CampoDelExport[],
  opts: { conGrupo: boolean; conPersonales: boolean },
): ColumnaDelExport[] {
  const t = (header: string, width: number): ColumnaDelExport => ({ header, kind: 'text', width })
  return [
    t('Quién respondió', 28),
    ...(opts.conGrupo ? [t('Grupo', 26), t('Dirigente', 24)] : []),
    // Del PERFIL, no de una pregunta: los encargados llaman a la gente y no
    // todos los formularios piden teléfono. Se titula «(perfil)» para que no
    // se confunda con la columna de una pregunta de teléfono.
    t('Teléfono (perfil)', 16),
    // FRM-4: vacío en el caso normal. Con valor = la digitó el staff.
    t('Registrada por', 24),
    { header: 'Fecha', kind: 'date', width: 14 },
    ...campos.map(f => {
      const h = encabezadoDeCampo(f.field_type, f.label)
      return { header: h, kind: excelCellKind(f.field_type), width: anchoDe(h) }
    }),
    // Al FINAL: las preguntas son lo que alguien vino a leer, y diez columnas
    // de padrón en el medio empujan la primera pregunta fuera de la pantalla.
    ...(opts.conPersonales
      ? COLUMNAS_PERSONALES.map(c => ({ header: c.header, kind: c.kind as CellKind, width: c.width }))
      : []),
  ]
}

/** Ancho por el encabezado, acotado: sin tope una pregunta larga deja una
 *  columna de 50 caracteres; sin piso, «Edad» queda ilegible. */
export const ANCHO_MIN = 12
export const ANCHO_MAX = 42
export function anchoDe(label: string): number {
  return Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, label.length + 2))
}

/** ¿Hace falta la columna de grupo? Lo dicen los datos, no el formulario. */
export function hayGrupo(respuestas: readonly RespuestaParaExport[]): boolean {
  return respuestas.some(r => (r.grupo ?? '') || (r.dirigente ?? ''))
}

/**
 * Los valores de una fila, alineados con `columnasDelExport`.
 *
 * `origin` es el dominio de ESTE despliegue: el link del adjunto tiene que
 * apuntar acá y no a una constante, porque Preview y producción son dominios
 * distintos.
 */
export function filaDeRespuesta(
  r: RespuestaParaExport,
  campos: readonly CampoDelExport[],
  opts: { conGrupo: boolean; ficha?: (FichaParaExport & { conyuge: string }) | null; origin?: string },
): Array<string | number | Date | null> {
  return [
    // Un formulario anónimo no trae nombre: se dice, no se deja en blanco.
    r.member_name || 'Anónimo',
    ...(opts.conGrupo ? [r.grupo || null, r.dirigente || null] : []),
    formatPhoneCR(r.member_phone) || null,
    r.recorded_by_name || null,
    r.submitted_at ? new Date(r.submitted_at) : null,
    ...campos.map(f =>
      answerToCell(r.answers[f.id], excelCellKind(f.field_type), opts.origin)),
    ...(opts.ficha !== undefined
      ? celdasPersonales(opts.ficha, opts.ficha?.conyuge ?? '')
      : []),
  ]
}

/**
 * Una celda como texto de CSV.
 *
 * La FECHA va en formato de Costa Rica y no ISO: este archivo se abre en Excel
 * y el ISO se lee como texto. Y el adjunto ya viene resuelto como link desde
 * `answerToCell`, así que acá no hay que volver a mirarlo — era la diferencia
 * número 2 entre los dos exports.
 */
export function celdaComoTexto(v: string | number | Date | null): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    return v.toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica' })
  }
  const s = String(v)
  return esPathDeAdjunto(s) ? urlDeAdjunto(s) : s
}

/** Los campos que generan columna. `personal_data` y `leader_availability`
 *  parecen campos pero escriben en la ficha y nunca guardan respuesta. */
export function camposConDatos<T extends { field_type: string }>(campos: readonly T[]): T[] {
  return campos.filter(f => isDataField(f.field_type))
}

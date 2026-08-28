// FRM-3 · Reglas del export XLSX de respuestas de formularios. Puro: la ruta
// solo pinta el archivo con ExcelJS.
//
// EL PROBLEMA QUE ESTO EVITA. Excel reinterpreta lo que parece número, y en un
// padrón eso corrompe datos de verdad:
//   · una cédula '01234567' pierde el cero y queda 1234567;
//   · un teléfono '50688887777' se convierte a notación científica (5.0689E+10);
//   · un '1-0234-0567' se puede leer como fecha o como resta.
// La defensa es declarar el formato de la columna como TEXTO ('@'), no confiar en
// que mandar un string alcance. Al revés también importa: una fecha tiene que ir
// como fecha real, porque si va como texto no se puede ordenar ni filtrar por
// rango, que es la mitad de para qué alguien baja un Excel.

import { esPathDeAdjunto, urlDeAdjunto } from './attachment'
import type { FieldType } from '@/types/forms'

/** Cómo entra el valor de este campo a la celda. */
export type CellKind = 'text' | 'number' | 'date' | 'link'

/**
 * Tipo de celda para un campo del formulario.
 *
 * Solo `number` y `scale` van como número: son los únicos donde el valor ES una
 * cantidad. Todo lo demás va como texto, incluidos los `select`/`radio` cuyas
 * opciones sean números ("1", "2", "3"), porque ahí el número es una etiqueta.
 */
export function excelCellKind(type: FieldType | string): CellKind {
  if (type === 'date') return 'date'
  if (type === 'number' || type === 'scale') return 'number'
  // La respuesta guarda un path del bucket privado, que solo no sirve de nada:
  // en el export se escribe el link que lo abre (ver lib/forms/attachment).
  if (type === 'image' || type === 'file') return 'link'
  return 'text'
}

/** Formato numérico de Excel para el tipo de celda. '@' fuerza TEXTO. */
export function excelNumFmt(kind: CellKind): string | undefined {
  if (kind === 'text' || kind === 'link') return '@'
  if (kind === 'date') return 'dd/mm/yyyy'
  return undefined
}

/**
 * Los tipos que NO son un campo con respuesta (no generan columna).
 *
 * `personal_data` entra acá y no es obvio: parece un campo (pide nombre, cédula,
 * teléfono) pero es un bloque que lee y ACTUALIZA el perfil de la persona, así
 * que nunca guarda nada en form_response_values — verificado en la base: 3
 * campos de ese tipo, 0 valores. Como columna solo aportaba una columna vacía.
 */
export const NON_DATA_FIELD_TYPES: readonly string[] =
  ['section', 'info', 'page_break', 'personal_data']

export function isDataField(type: FieldType | string): boolean {
  return !NON_DATA_FIELD_TYPES.includes(type)
}

/**
 * Ancho de columna: se estima por el encabezado, acotado a un rango legible.
 *
 * Sin tope, una pregunta larga («¿Demostró el dirigente un buen conocimiento
 * del material?») deja una columna de 50 caracteres y el resto no entra en
 * pantalla. Sin piso, "Edad" queda ilegible.
 */
export const COL_WIDTH_MIN = 12
export const COL_WIDTH_MAX = 42

export function columnWidthFor(label: string): number {
  return Math.min(COL_WIDTH_MAX, Math.max(COL_WIDTH_MIN, label.length + 2))
}

/** El valor de una respuesta como texto de celda. Las múltiples (checkbox)
 *  se unen con coma, igual que en el CSV, para que los dos exports coincidan. */
export function answerToText(ans: unknown): string {
  if (ans === null || ans === undefined) return ''
  if (Array.isArray(ans)) return ans.join(', ')
  return String(ans)
}

/** El valor listo para la celda, según el tipo. Devuelve null cuando está vacío
 *  (una celda vacía es mejor que un 0 o un 1970 inventado). */
export function answerToCell(ans: unknown, kind: CellKind, origin?: string): string | number | Date | null {
  const txt = answerToText(ans).trim()
  if (!txt) return null

  if (kind === 'link') {
    // Se escribe el link a NUESTRA ruta y no una URL firmada: la firmada dura
    // minutos y el Excel se abre cuando alguien puede, no cuando se generó.
    return esPathDeAdjunto(txt) ? urlDeAdjunto(txt, origin) : txt
  }

  if (kind === 'number') {
    const n = Number(txt)
    // Si no es un número de verdad, se cae a texto en vez de escribir NaN.
    return Number.isFinite(n) ? n : txt
  }
  if (kind === 'date') {
    // Solo ISO (YYYY-MM-DD) o algo que Date entienda; se ancla a mediodía UTC
    // para que la fecha no se corra un día al mostrarla en Costa Rica.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt)
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12))
    const d = new Date(txt)
    return isNaN(d.getTime()) ? txt : d
  }
  return txt
}

/** Nombre del archivo. Sin espacios ni acentos: viaja por HTTP y por Windows. */
export function xlsxFileName(formName: string): string {
  const base = (formName || 'formulario')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'formulario'
  return `${base}-respuestas.xlsx`
}

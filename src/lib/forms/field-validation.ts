// Qué campo de un formulario está incompleto y no deja guardar.
//
// Bug 2026-08-06: el inspector del bloque de TEXTO INFORMATIVO dice "Título
// (opcional)" —y es correcto: el contenido va en el texto, no en el título—,
// pero el guardado exigía etiqueta a todos los campos por igual. La pantalla
// decía una cosa y el guard otra.
//
// Puro para que la regla viva en un solo lado.
import type { FieldType } from '@/types/forms'

/** Tipos que NO necesitan etiqueta:
 *  · page_break   — es un corte de página, no una pregunta;
 *  · info         — bloque de solo lectura; su contenido es el TEXTO, y el
 *                   título es opcional (así lo dice el propio inspector);
 *  · studies_done — es OCULTO: no se le muestra a quien responde, así que
 *                   exigirle un título es pedir un texto que nadie va a leer.
 *                   En el export la columna sale con su nombre por defecto
 *                   (ver encabezadoDeCampo). */
export const LABEL_OPTIONAL: FieldType[] = ['page_break', 'info', 'studies_done']

export type FieldLike = {
  id: string
  type: FieldType
  label: string
  description?: string | null
}

export type FieldProblem = { fieldId: string; message: string }

/** El primer problema de cada campo, o [] si están todos bien. */
export function fieldProblems(fields: readonly FieldLike[]): FieldProblem[] {
  const out: FieldProblem[] = []
  for (const f of fields) {
    if (f.type === 'info') {
      // Un bloque informativo sin NADA es un recuadro vacío en el formulario.
      // Lo que hace falta es el texto; el título sigue siendo opcional.
      if (!f.label.trim() && !(f.description ?? '').trim()) {
        out.push({ fieldId: f.id, message: 'El bloque de texto informativo está vacío: escribí el texto.' })
      }
      continue
    }
    if (LABEL_OPTIONAL.includes(f.type)) continue
    if (!f.label.trim()) {
      out.push({ fieldId: f.id, message: 'Este campo no tiene etiqueta.' })
    }
  }
  return out
}

/** Mensaje del toast al intentar guardar. null = se puede guardar. */
export function saveBlockedMessage(fields: readonly FieldLike[]): string | null {
  const problemas = fieldProblems(fields)
  if (problemas.length === 0) return null
  if (problemas.length === 1) return problemas[0].message
  return `Hay ${problemas.length} campos incompletos. El primero: ${problemas[0].message.toLowerCase()}`
}

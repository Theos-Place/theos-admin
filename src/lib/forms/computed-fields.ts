// Campos CALCULADOS de un formulario: los llena el sistema, no quien responde.
//
// El primero es "estudios aprobados": una foto de lo que la persona lleva
// aprobado en el momento de contestar. Sirve al comité que revisa las
// respuestas y NO se le muestra a quien llena — no es una pregunta.
//
// LOS LLENA EL SERVIDOR, al recibir la respuesta. Mandarlos desde el navegador
// sería dejar que quien responde decida qué estudios dice tener, que es
// exactamente lo que el campo no debe permitir.

import type { FieldType } from '@/types/forms'

/** Tipos que el sistema calcula solo. No se dibujan al responder. */
export const COMPUTED_FIELD_TYPES = ['studies_done'] as const
export type ComputedFieldType = (typeof COMPUTED_FIELD_TYPES)[number]

export function esCampoCalculado(type: FieldType | string): boolean {
  return (COMPUTED_FIELD_TYPES as readonly string[]).includes(type)
}

/**
 * El texto que se guarda como respuesta de "estudios aprobados".
 *
 * Una sola celda con los nombres separados por coma: es lo que se lee de un
 * vistazo en el Excel. Ordenado por fecha de aprobación, del más viejo al más
 * nuevo, que es como se cuenta una trayectoria.
 */
export function textoEstudiosAprobados(
  estudios: Array<{ nombre: string; fecha: string | null }>,
): string {
  if (!estudios.length) return 'Ninguno'
  return [...estudios]
    .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
    .map(e => e.nombre)
    .join(', ')
}

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

/** Nombre por defecto de cada campo calculado, para cuando no tiene etiqueta. */
export const NOMBRE_POR_DEFECTO: Record<ComputedFieldType, string> = {
  studies_done: 'Estudios aprobados',
}

/**
 * El encabezado de la columna en el export.
 *
 * Un campo oculto no necesita título —nadie lo lee al responder— pero la
 * columna del Excel sí necesita nombre: una columna sin encabezado no se
 * entiende. Si alguien le puso etiqueta, manda la suya.
 */
export function encabezadoDeCampo(tipo: string, label?: string | null): string {
  const propia = (label ?? '').trim()
  if (propia) return propia
  return NOMBRE_POR_DEFECTO[tipo as ComputedFieldType] ?? ''
}

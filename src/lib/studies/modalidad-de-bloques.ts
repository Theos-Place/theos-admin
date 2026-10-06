/**
 * EST-14 · Quién vive bajo el esquema VIEJO y quién bajo el de BLOQUES.
 *
 * EL BUG QUE ESTO ARREGLA (producción, 2026-10-05). EST-14 hizo que los
 * cierres 1→2 y 3→4 dejaran de generar folletos y cobros, porque bajo bloques
 * el par ya se pagó y se entregó al entrar. Correcto para los grupos nuevos,
 * y DESTRUCTIVO para los que venían de antes: ésos pagaron solo su nivel y
 * recibieron solo su folleto, así que su paso al siguiente sí tiene que
 * cobrar y pedir folleto. Cinco cierres de N3 quedaron sin nada el mismo día.
 *
 * POR QUÉ NO ALCANZA UNA FECHA, que era el criterio propuesto. Se midió y
 * falla en los dos sentidos:
 *
 *  · Los 5 grupos de N4 que hay que reparar se CREARON el 2026-10-05, como
 *    sucesores de grupos legacy. Por fecha serían «bloques» — justo los que
 *    no lo son. Por eso el sucesor HEREDA la modalidad de su origen en vez
 *    de mirarse el reloj.
 *
 *  · Y hay GRUPOS MIXTOS, que es lo que de verdad rompe el modelo de una
 *    marca por grupo: el N3 de Michelle Guier (creado en julio) tiene 9
 *    estudiantes viejos y 1 que se matriculó el 5 de octubre pagando
 *    ₡10.000, el bloque N3+N4 completo. Cobrarle N4 al cerrar sería cobrarle
 *    dos veces algo que ya pagó. Lo mismo en 4 grupos de N1.
 *
 * DE AHÍ LAS DOS MARCAS, que responden preguntas distintas:
 *
 *   · `study_groups.modalidad` — QUÉ REGLA aplica este grupo: qué folletos
 *     pide y qué niveles cobra. Es del grupo porque el tiquete de folletos
 *     es del grupo.
 *   · `study_enrollments.cubre_bloque` — si ESTA PERSONA ya pagó el par. Es
 *     de la matrícula porque dentro de un mismo grupo conviven las dos.
 *
 * Módulo PURO.
 */

export const MODALIDADES = ['legacy', 'bloques'] as const
export type Modalidad = (typeof MODALIDADES)[number]

/** `legacy` es el default defensivo: ver `modalidadDe`. */
export const MODALIDAD_POR_DEFECTO: Modalidad = 'legacy'

/**
 * La modalidad de un grupo, con el default del lado seguro.
 *
 * Un valor desconocido o ausente cae en `legacy`, y la elección es
 * deliberada: equivocarse hacia legacy genera un cobro y un folleto de más
 * —visible, reclamable, corregible— y equivocarse hacia bloques deja a un
 * estudiante sin folleto y a Theos sin cobrar, que es el error que nadie ve
 * hasta que alguien llega a clase sin material.
 */
export function modalidadDe(valor: string | null | undefined): Modalidad {
  return valor === 'bloques' ? 'bloques' : MODALIDAD_POR_DEFECTO
}

export function esLegacy(valor: string | null | undefined): boolean {
  return modalidadDe(valor) === 'legacy'
}

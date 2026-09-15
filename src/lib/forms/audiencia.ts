/**
 * FRM-5 · A quién se le ofrece un formulario.
 *
 * La regla es la MISMA que la de los grupos de estudio y vive en
 * `@/lib/audiencia/restriccion`. Acá está solo lo propio del formulario: cómo se
 * le explica a quien no cumple, con qué código lo rechaza el endpoint, y la
 * consecuencia que tiene sobre `requires_auth`.
 */
import { restrictionSummary, hasRestriction, type Restriccion } from '@/lib/audiencia/restriccion'

export type { Restriccion }

/** Código del 403 cuando alguien fuera de la audiencia abre o envía el form. */
export const FUERA_DE_AUDIENCIA = 'fuera_de_audiencia'

/** Dice POR QUÉ, no "no tenés permiso". El link se comparte por WhatsApp y le
 *  va a llegar a gente que no cumple: que entienda de una que no es para ella. */
export function mensajeFueraDeAudiencia(r: Restriccion | null | undefined): string {
  const resumen = restrictionSummary(r)
  return resumen
    ? `Este formulario es solo para: ${resumen}.`
    : 'Este formulario está limitado a cierto grupo de personas.'
}

/**
 * Una restricción exige saber QUIÉN es la persona, y un formulario público
 * anónimo por definición no lo sabe. No es una validación cosmética: sin
 * sesión no hay contra quién evaluar la condición, así que la restricción
 * quedaría escrita y sin aplicarse — lo peor de los dos mundos.
 *
 * Por eso no se rechaza el guardado: se FUERZA `requires_auth` y se explica.
 */
export function exigeIdentificarse(r: Restriccion | null | undefined): boolean {
  return hasRestriction(r)
}

export const AVISO_EXIGE_CUENTA =
  'Con una restricción de audiencia el formulario pide iniciar sesión: sin saber quién es la persona no hay forma de aplicar la condición.'

/** Los campos del formulario que la restricción obliga a ajustar. Se aplica en
 *  el servidor Y se refleja en el builder, para que lo guardado y lo que se ve
 *  digan lo mismo. */
export function ajustesPorRestriccion(
  r: Restriccion | null | undefined,
): { requires_auth: true } | null {
  return exigeIdentificarse(r) ? { requires_auth: true } : null
}

/**
 * ¿Sobre QUIÉN se evalúa la condición?
 *
 * Cuando el staff llena "a nombre de" otra persona (FRM-4), la audiencia
 * describe a esa persona y no a quien teclea. Un coordinador llenando el
 * formulario de un servidor no lo convierte a él en el destinatario.
 */
export function aQuienSeEvalua(
  opts: { autorId: string | null; aNombreDeId?: string | null },
): string | null {
  return opts.aNombreDeId ?? opts.autorId
}

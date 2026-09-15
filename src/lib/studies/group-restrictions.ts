// GRU-2 · La restricción de audiencia de un GRUPO de estudio.
//
// La regla vive en `@/lib/audiencia/restriccion`, compartida con los
// formularios (FRM-5): es la misma pregunta y tener dos modelos garantiza que
// se desincronicen. Acá queda solo lo que es del grupo — cómo se le explica al
// que no cumple y con qué código lo rechaza el endpoint.
//
// A quién se le OFRECE este grupo. Es del grupo, no del plan: dos grupos de la
// misma capacitación pueden tener restricciones distintas, o uno tenerla y el
// otro no. Los compromisos de la etapa (donante, servidor, asistencia,
// prerequisito, invitación) viven en el plan y se evalúan aparte — la
// restricción se SUMA, nunca reemplaza.
import { restrictionSummary, type Restriccion } from '@/lib/audiencia/restriccion'

export {
  ALLOWED_RESTRICTION_TYPES, isAllowedRestrictionType, EMPTY_RESTRICTION,
  hasRestriction, normalizeRestriction, restrictionSummary,
  type RestrictionType,
} from '@/lib/audiencia/restriccion'

/** Nombre histórico del tipo compartido; se conserva para no tocar los callers. */
export type GroupRestriction = Restriccion

/** Mensaje del bloqueo, para la UI y para el 409 del endpoint. Dice POR QUÉ, no
 *  "no cumplís los requisitos". */
export function restrictionBlockedMessage(r: Restriccion | null | undefined): string {
  const resumen = restrictionSummary(r)
  return resumen
    ? `Este grupo es solo para: ${resumen}.`
    : 'Este grupo tiene una restricción de audiencia que no cumplís.'
}

/** Código del 409 cuando alguien no cumple la restricción del grupo. */
export const RESTRICTION_ERROR_CODE = 'restriccion_grupo'

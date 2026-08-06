// ¿Esta persona puede LLENAR este formulario?
//
// Decisión 2026-08-06: la página de Formularios nunca estuvo abierta —eso ya lo
// cuida el módulo—, pero el llenado sí: cualquiera con sesión y el link podía
// abrir y ENVIAR cualquier formulario. Con la preinscripción a CDEB eso
// significa que alguien no recomendado podía preinscribirse igual y ensuciar la
// cola del comité.
//
// La regla es "solo quien fue convocado", y se resuelve con las señales que ya
// existen. El caller consulta la base y esta función decide.

export type FillAccessInput = {
  /** Tiene el módulo de formularios, o un acceso puntual a ESTE formulario. */
  isStaff: boolean
  /** entity_type del formulario: 'event' | 'study_group' | 'general' | null. */
  entityType: string | null
  /** Está inscrito al evento dueño del formulario. */
  isEventRegistrant: boolean
  /** Está matriculado en el grupo dueño del formulario. */
  isGroupEnrolled: boolean
  /** El formulario tiene una audiencia definida (es de selección/preinscripción
   *  y por lo tanto hay una lista de convocados). */
  hasConvocationList: boolean
  /** Está en esa lista de convocados. */
  isConvoked: boolean
  /** Recibió un correo con el link de ESTE formulario. */
  wasSentLink: boolean
  /** Ya respondió antes (para no dejar afuera a quien está corrigiendo). */
  hasResponded: boolean
  /** El formulario está marcado como ABIERTO (forms.is_public): cualquiera con
   *  el link puede llenarlo. Es la escapatoria explícita para los que se
   *  comparten por WhatsApp. */
  isPublic: boolean
}

export type FillAccess =
  | { allowed: true }
  | { allowed: false; reason: string }

export const NOT_FOR_YOU =
  'Este formulario no está abierto para vos. Si creés que sí te corresponde, escribinos y lo revisamos.'

export function formFillAccess(i: FillAccessInput): FillAccess {
  // Quien administra formularios entra siempre: prueba, corrige y responde a
  // nombre de otra persona.
  if (i.isStaff) return { allowed: true }
  // Quien ya respondió no se queda afuera de su propia respuesta.
  if (i.hasResponded) return { allowed: true }
  // Se lo mandamos por correo: eso ES la convocatoria.
  if (i.wasSentLink) return { allowed: true }

  if (i.entityType === 'event') {
    return i.isEventRegistrant
      ? { allowed: true }
      : { allowed: false, reason: 'Este formulario es para las personas inscritas al evento.' }
  }
  if (i.entityType === 'study_group') {
    return i.isGroupEnrolled
      ? { allowed: true }
      : { allowed: false, reason: 'Este formulario es para las personas matriculadas en ese grupo.' }
  }
  // Formulario con audiencia definida (preinscripción/selección): solo los
  // convocados.
  if (i.hasConvocationList) {
    return i.isConvoked
      ? { allowed: true }
      : { allowed: false, reason: 'Este formulario es solo para las personas convocadas por el comité.' }
  }
  // Formulario suelto SIN audiencia y sin envío registrado. Cerrado por defecto
  // (decisión 2026-08-06): si no sabemos a quién va dirigido, no va dirigido a
  // cualquiera. Para los que sí se comparten por WhatsApp está la casilla
  // "abierto a cualquiera con el link" (forms.is_public), que hay que marcar a
  // propósito.
  return i.isPublic
    ? { allowed: true }
    : { allowed: false, reason: NOT_FOR_YOU }
}

// FIN-2 · Aviso "completá tu documento" al entrar al sistema.
//
// El aviso es DESCARTABLE y reaparece a los 14 días. El descarte se guarda con
// FECHA (no con un booleano) para poder calcular el vencimiento: un booleano
// silenciaría el aviso para siempre.

/** Días que el aviso queda silenciado después de un descarte. */
export const DOCUMENT_PROMPT_SNOOZE_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

/** Clave del aviso en notice_dismissals. */
export const DOCUMENT_PROMPT_NOTICE = 'document_prompt'

export type DocumentPromptInput = {
  /** El miembro ya tiene documento registrado. */
  hasDocument: boolean
  /** Perfil de sistema (no es una persona real). */
  isSystem?: boolean
  /** Sesión sin miembro ligado: no hay perfil que completar. */
  hasMember?: boolean
  /** Fecha del último descarte (ISO o Date). null/undefined = nunca descartó. */
  dismissedAt?: string | Date | null
  /** "Ahora" — inyectable para tests. */
  now?: Date
}

/**
 * ¿Se le muestra el aviso de documento a esta persona?
 *
 * No se muestra si: ya tiene documento, es perfil de sistema, la sesión no
 * tiene miembro ligado, o descartó hace menos de DOCUMENT_PROMPT_SNOOZE_DAYS.
 */
export function shouldShowDocumentPrompt(input: DocumentPromptInput): boolean {
  const { hasDocument, isSystem = false, hasMember = true, dismissedAt = null } = input
  if (hasDocument || isSystem || !hasMember) return false
  if (!dismissedAt) return true

  const dismissed = dismissedAt instanceof Date ? dismissedAt : new Date(dismissedAt)
  // Fecha inválida (dato corrupto): se muestra el aviso — es lo conservador,
  // el objetivo es completar el documento.
  if (Number.isNaN(dismissed.getTime())) return true

  const now = input.now ?? new Date()
  const elapsedDays = (now.getTime() - dismissed.getTime()) / DAY_MS
  // Un descarte con fecha futura (reloj corrido) no silencia para siempre:
  // elapsedDays negativo < umbral ⇒ oculto hasta que la fecha pase.
  return elapsedDays >= DOCUMENT_PROMPT_SNOOZE_DAYS
}

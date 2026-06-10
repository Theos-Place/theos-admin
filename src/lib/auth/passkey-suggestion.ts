import { createClient } from '@/lib/supabase/client'

/**
 * Sugerencia de passkey tras el primer login. Guardamos la decisión del usuario
 * en localStorage para no molestar:
 *   - (sin valor)  → nunca se mostró → sugerir
 *   - 'never'      → pidió no volver a ver → no sugerir nunca
 *   - 'registered' → ya tiene passkey → no sugerir nunca
 * "Ahora no" limpia el valor para volver a preguntar en el próximo login.
 */
export const PASSKEY_SUGGESTION_KEY = 'theos_passkey_suggested'

export type PasskeySuggestionValue = 'never' | 'registered'

export function setPasskeySuggestion(value: PasskeySuggestionValue) {
  try { localStorage.setItem(PASSKEY_SUGGESTION_KEY, value) } catch { /* storage no disponible */ }
}

export function clearPasskeySuggestion() {
  try { localStorage.removeItem(PASSKEY_SUGGESTION_KEY) } catch { /* storage no disponible */ }
}

/** ¿El dispositivo soporta passkeys con autenticador de plataforma (huella/Face ID)? */
export async function deviceSupportsPasskeys(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Decide si mostrar el modal de sugerencia tras un login exitoso. Devuelve true
 * solo si: el dispositivo soporta passkeys, el usuario no tiene ninguna y nunca
 * rechazó permanentemente la sugerencia. Si ya tiene una, deja marca 'registered'.
 */
export async function shouldSuggestPasskey(): Promise<boolean> {
  let stored: string | null = null
  try { stored = localStorage.getItem(PASSKEY_SUGGESTION_KEY) } catch { /* ignore */ }
  if (stored === 'never' || stored === 'registered') return false

  if (!(await deviceSupportsPasskeys())) return false

  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.passkey.list()
    if (error) return false // ante la duda, no molestamos
    if (data && data.length > 0) {
      setPasskeySuggestion('registered')
      return false
    }
    return true
  } catch {
    return false
  }
}

/** Detecta si el error de registro fue una cancelación del prompt del navegador. */
export function isPasskeyCancel(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; name?: string; message?: string }
  return e.code === 'ERROR_CEREMONY_ABORTED'
    || e.name === 'NotAllowedError'
    || e.name === 'AbortError'
    || /aborted|cancel|not allowed/i.test(e.message ?? '')
}

// Estado de la cuenta de acceso de un miembro. Tres casos que se resuelven
// distinto y que hasta el 2026-08-04 vivían mezclados en "cuenta sin activar":
//
//   · 'none'          → no tiene usuario de Auth (auth_user_id null). Caso raro:
//                       correo rebotado, ficha duplicada o sin correo.
//                       Acción: crearle la cuenta.
//   · 'never_entered' → tiene usuario pero nunca inició sesión. Es el caso
//                       normal hoy: AUTH-1 creó 18.101 cuentas en lote con
//                       contraseña aleatoria. Acción: mandarle las instrucciones.
//   · 'active'        → ya entró al menos una vez.
//
// OJO: 'active' NO se deduce de tener usuario creado ni de tener el correo
// confirmado — sale de last_sign_in_at. Quién nunca ha entrado es la métrica de
// adopción de agosto 2026 (al 2026-08-04: 5.219 / 18.070 / 31) y marcar activo
// a todo el que tiene usuario la borraría.
//
// Puro y sin Supabase: lo usan el adaptador del padrón, la ficha del miembro y
// el endpoint de estado de cuenta.

export type AccountState = 'none' | 'never_entered' | 'active'

export function accountState(input: {
  /** members.auth_user_id */
  authUserId: string | null | undefined
  /** members.last_sign_in_at (espejo de auth.users.last_sign_in_at) */
  lastSignInAt: string | null | undefined
}): AccountState {
  if (!input.authUserId) return 'none'
  return input.lastSignInAt ? 'active' : 'never_entered'
}

/** Etiqueta de la insignia. Describe un HECHO, no pide una acción: "sin
 *  activar" hacía que el staff mandara la invitación que estaba rota. */
export const ACCOUNT_STATE_LABEL: Record<AccountState, string> = {
  none: 'Sin cuenta',
  never_entered: 'Nunca ha entrado',
  active: 'Activa',
}

/** Qué hacer con cada estado (se muestra en la ficha del miembro). */
export const ACCOUNT_STATE_ACTION: Record<AccountState, string | null> = {
  none: 'Crearle la cuenta de acceso.',
  never_entered: 'Mandarle las instrucciones para entrar.',
  active: null,
}

/** Etiqueta larga, para los chips de filtros del padrón. */
export const ACCOUNT_STATE_FILTER_LABEL: Record<AccountState, string> = {
  none: 'Sin cuenta',
  never_entered: 'Nunca ha entrado',
  active: 'Cuenta activa',
}

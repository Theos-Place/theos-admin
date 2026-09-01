// En qué orden intentar generar el enlace de contraseña.
//
// El botón "Restablecé tu contraseña" de la pantalla de ingreso (hasta el
// 2026-09-01 eran dos, "primera vez" y "olvidé mi contraseña") y el de
// "¿Olvidaste tu contraseña?" caen en el MISMO flujo, y la persona no tiene por
// qué saber en cuál de los tres estados está su cuenta:
//
//   · 18,101 miembros ya tienen cuenta enlazada (creadas en lote) → 'recovery'.
//   · 119 activos con correo NO tienen cuenta todavía        → 'invite' (la crea).
//   · Y puede haber una cuenta que exista en Auth pero sin enlazar al miembro
//     (le pasó a una persona real): ahí 'invite' falla con "ya registrado" y hay
//     que caer a 'recovery'.
//
// Adivinar por `auth_user_id` no alcanza — si el dato está desincronizado, la
// persona se queda sin correo y sin explicación. Por eso se intenta uno y, si
// falla, el otro.

export type PasswordLinkKind = 'invite' | 'recovery'

/** Orden de intentos. `tieneCuenta` es solo una PISTA (members.auth_user_id):
 *  si está mal, el segundo intento cubre. */
export function linkAttemptOrder(tieneCuenta: boolean): PasswordLinkKind[] {
  return tieneCuenta ? ['recovery', 'invite'] : ['invite', 'recovery']
}

/** ¿Vale la pena reintentar con el otro tipo, según el error de Supabase? */
export function shouldTryOtherKind(errorMessage: string | null | undefined): boolean {
  const msg = (errorMessage ?? '').toLowerCase()
  if (!msg) return false
  // "User already registered" (al invitar a quien ya existe) y
  // "user not found" (al recuperar a quien no existe) son los dos cruces.
  return msg.includes('already') || msg.includes('registered')
    || msg.includes('not found') || msg.includes('no user')
}

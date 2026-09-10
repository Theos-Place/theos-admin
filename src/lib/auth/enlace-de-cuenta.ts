/**
 * A quién le pertenece una cuenta de Auth recién creada.
 *
 * `buildPasswordLink` con tipo 'invite' CREA el usuario de Supabase Auth, pero
 * nadie escribía `members.auth_user_id`. Como `getAuthContext` resuelve la ficha
 * por `auth_user_id`, esa persona entraba SIN PERFIL. Encontrado el 2026-09-09
 * con 3 casos reales (Samara, Julia, Victoria).
 *
 * El enlace automático es deliberadamente cobarde: si el correo lo comparten dos
 * fichas (pasa mucho en familias), no adivina — deja el enlace sin hacer.
 */
export type FichaConCorreo = { id: string; auth_user_id: string | null }

export type PlanDeEnlace =
  | { accion: 'enlazar'; memberId: string }
  | { accion: 'nada'; motivo: 'sin_ficha' | 'correo_compartido' | 'ya_enlazada' | 'cuenta_de_otra_ficha' | 'ficha_con_otra_cuenta' }

/**
 * @param fichas       miembros cuyo correo es el de la cuenta
 * @param authUserId   la cuenta de Auth recién creada
 * @param duenoActual  id del miembro que YA tiene ese auth_user_id, si alguno
 */
export function planDeEnlace(
  fichas: FichaConCorreo[],
  authUserId: string,
  duenoActual: string | null,
): PlanDeEnlace {
  if (duenoActual) {
    return { accion: 'nada', motivo: fichas.some(f => f.id === duenoActual) ? 'ya_enlazada' : 'cuenta_de_otra_ficha' }
  }
  if (fichas.length === 0) return { accion: 'nada', motivo: 'sin_ficha' }
  if (fichas.length > 1) return { accion: 'nada', motivo: 'correo_compartido' }
  const ficha = fichas[0]
  if (ficha.auth_user_id) return { accion: 'nada', motivo: 'ficha_con_otra_cuenta' }
  return { accion: 'enlazar', memberId: ficha.id }
}

/**
 * ¿La ficha de esta persona sigue habilitada para entrar?
 *
 * Hasta el 2026-08-29 desactivar a un miembro solo ponía `is_active: false` en
 * su ficha, y NADIE lo miraba al leer la sesión: la persona seguía entrando y
 * operando con todos sus roles. No llegó a pasar (13 desactivados, 2 con
 * cuenta, 0 entraron después), pero desactivar no cortaba el acceso.
 *
 * Vive acá y no suelto en cada lector por la lección de `withBaseRole`: un
 * invariante copiado en dos lugares termina mal en uno de los dos. Lo usan
 * getAuthContext (servidor) y /api/auth/me (cliente), que TIENEN que coincidir.
 *
 * `is_active` null/undefined cuenta como ACTIVA: la columna es vieja y hay
 * fichas previas al default; negar por un null bloquearía a gente sana.
 */
export function cuentaHabilitada(member: { is_active?: boolean | null } | null | undefined): boolean {
  if (!member) return false
  return member.is_active !== false
}

/** Código que viaja al cliente para distinguir "desactivada" de "sin sesión".
 *  Sin esto el cliente la trata como no autenticada, la manda al login, el
 *  proxy ve la cookie viva y la devuelve al dashboard: un rebote infinito. */
export const CUENTA_DESACTIVADA = 'cuenta_desactivada'

/** Lo que se le dice a la persona. No dice por qué (el motivo de la baja es
 *  interno) y sí dice a quién escribirle. */
export const MENSAJE_CUENTA_DESACTIVADA =
  'Tu cuenta está desactivada. Si creés que es un error, escribinos a soporte@theosplace.org.'

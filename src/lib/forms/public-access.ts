// ¿Este formulario se puede abrir y contestar SIN cuenta? (módulo puro)
//
// Dos banderas, que no son lo mismo y por eso son dos:
//
//   · is_public     — "cualquiera con el link puede llenarlo". Ya existía y ya
//                     la usa formFillAccess: apaga el filtro de convocatoria.
//   · requires_auth — si hace falta entrar con cuenta. Existía en la tabla
//                     desde el principio, en true en los 23 formularios, y
//                     NADIE la leía. Es la que abre el formulario al mundo.
//
// Se exigen LAS DOS para que sea público. Un formulario con is_public pero
// requires_auth queda como hasta hoy: link para cualquiera, pero con cuenta.
// Y uno con requires_auth en false pero sin is_public NO se abre: sería un
// formulario de convocatoria expuesto sin filtro, que es la peor combinación
// posible y la más fácil de dejar por accidente.
//
// FRM-5 agrega una tercera condición: una restricción de audiencia CIERRA el
// formulario al mundo. Guardar una restricción ya fuerza requires_auth, así que
// en la práctica esto es redundante — y por eso mismo está: si alguna vez una
// restricción llega por otro camino (SQL directo, una fila vieja) sin el flag,
// la diferencia entre redundante y ausente es que cualquiera conteste un
// formulario que dice ser solo para servidores.

export type FormPublicFlags = {
  is_public: boolean
  requires_auth: boolean
  is_active: boolean
  /** FRM-5. Cualquier valor no nulo cierra el formulario al público. */
  audience_restrictions?: unknown
}

/** ¿Se puede abrir sin cuenta? */
export function esFormularioAbierto(f: FormPublicFlags): boolean {
  return f.is_active && f.is_public && !f.requires_auth && !tieneAudienciaRestringida(f)
}

/** Una restricción con condiciones. Se mira el contenido y no solo el `null`:
 *  un `{conditions: []}` guardado por un builder es "sin restricción". */
export function tieneAudienciaRestringida(f: FormPublicFlags): boolean {
  const r = f.audience_restrictions
  if (!r || typeof r !== 'object') return false
  const cs = (r as { conditions?: unknown }).conditions
  return Array.isArray(cs) && cs.length > 0
}

export type EnvioInvitado = {
  nombre: string
  correo: string
}

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Qué le falta a un envío de invitado, o null si está completo.
 *
 * El nombre y el correo son obligatorios porque son la ÚNICA identidad que va a
 * tener esa respuesta: sin ellos queda una fila anónima que nadie puede
 * contestar ni verificar. La restricción response_member_or_guest de la base
 * exige lo mismo.
 */
export function faltaEnEnvioInvitado(e: Partial<EnvioInvitado>): string | null {
  if (!(e.nombre ?? '').trim()) return 'Escribí tu nombre.'
  const correo = (e.correo ?? '').trim()
  if (!correo) return 'Escribí tu correo.'
  if (!CORREO_RE.test(correo)) return 'Ese correo no parece válido.'
  return null
}

/**
 * Tope de envíos por IP en una ventana, para un formulario abierto.
 *
 * Sin sesión no hay a quién limitarle nada más que la dirección. Cinco por hora
 * es holgado para una familia que contesta desde la misma casa y molesto para
 * quien quiera llenar la tabla a mano.
 */
export const ENVIOS_MAX_POR_IP = 5
export const VENTANA_MS = 60 * 60 * 1000

/** La clave del rate limit. Va por formulario: llenar uno no bloquea los demás. */
export function claveLimite(formId: string, ip: string): string {
  return `form-publico:${formId}:${ip || 'sin-ip'}`
}

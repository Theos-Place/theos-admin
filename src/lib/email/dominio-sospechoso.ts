/**
 * Dominios de correo mal escritos.
 *
 * EL PROBLEMA, medido en producción el 2026-10-05: 53 fichas ACTIVAS tienen
 * el dominio mal escrito —`gmai.com`, `hormail.com`, `hotmal.com`,
 * `gmail.con`—. Esas personas no reciben NADA del sistema: ni el enlace de
 * contraseña, ni avisos, ni confirmaciones. Y falla en silencio: el correo
 * sale, rebota contra un dominio que no existe, y de este lado todo se ve
 * normal. Se descubre cuando alguien reclama por WhatsApp, que fue
 * exactamente el caso de Diego Alfaro Cardozo (`diego-alfaro@hotmal.com`).
 *
 * UNA SUGERENCIA, NO UN BLOQUEO. La lista son dominios que casi con certeza
 * son un dedazo, pero «casi» no es «seguro»: existen dominios raros
 * legítimos, y bloquear a alguien por tener un correo de empresa poco común
 * sería peor que el problema. Se le muestra «¿quisiste decir…?» y decide la
 * persona.
 *
 * Módulo PURO: no consulta DNS. Verificar el dominio de verdad pediría una
 * llamada de red en cada tecla, y la lista cubre lo que de verdad pasa.
 */

/** Dedazo → el dominio que seguramente se quiso escribir. */
export const DOMINIOS_MAL_ESCRITOS: Record<string, string> = {
  // hotmail
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hormail.com': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'htomail.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.cm': 'hotmail.com',
  // gmail
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  // yahoo
  'yahoo.con': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  // outlook e icloud
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outloo.com': 'outlook.com',
  'icloud.con': 'icloud.com',
  'iclod.com': 'icloud.com',
}

/** El dominio de un correo, en minúsculas. Vacío si no tiene forma de correo. */
export function dominioDe(email: string | null | undefined): string {
  if (!email) return ''
  const partes = email.trim().toLowerCase().split('@')
  return partes.length === 2 ? partes[1] : ''
}

/**
 * ¿Quisiste decir otra cosa? Devuelve el correo corregido, o `null` si el
 * dominio no está en la lista.
 *
 * Devuelve el CORREO ENTERO y no solo el dominio para que la pantalla pueda
 * ofrecerlo tal cual: escribirlo a mano de nuevo es donde se mete el
 * siguiente dedazo.
 */
export function correoSugerido(email: string | null | undefined): string | null {
  const dominio = dominioDe(email)
  if (!dominio) return null
  const bueno = DOMINIOS_MAL_ESCRITOS[dominio]
  if (!bueno) return null
  const usuario = (email as string).trim().split('@')[0]
  return `${usuario}@${bueno}`
}

/** El aviso para la pantalla. Vacío si no hay nada que avisar. */
export function avisoDeDominio(email: string | null | undefined): string {
  const sugerido = correoSugerido(email)
  return sugerido ? `¿Quisiste decir ${sugerido}?` : ''
}

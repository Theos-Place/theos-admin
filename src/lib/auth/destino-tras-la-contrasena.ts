// AUT-3 · A dónde va alguien después de definir su contraseña, y cómo ese
// destino sobrevive el viaje por el correo.
//
// EL BUG QUE ARREGLA (2026-09-21). El camino de un usuario nuevo era:
//
//   /login?redirect=/matricula
//     → "Restablecé tu contraseña"        ← acá SE PERDÍA el destino
//     → correo → /auth/continuar → /recuperar/nueva-contrasena
//     → define la contraseña
//     → router.push('/login')             ← y acá lo mandábamos a escribirla otra vez
//
// Las dos cosas están mal. La segunda es la peor: al abrir el enlace del correo
// la sesión YA quedó abierta —por eso la pantalla puede leer su correo y
// saludarlo— así que devolverlo al login es pedirle que se identifique cuando
// el sistema ya sabe quién es. Alguien que nunca tuvo contraseña lee eso como
// "no funcionó" y vuelve a pedir el enlace.
//
// La primera hace que, aun entrando derecho, aterrice en el dashboard en vez de
// en la matrícula que estaba tratando de hacer.
//
// Este módulo es la regla sola, sin React ni Supabase, para poder probarla.

import { safeDest, isSafeDest, DEFAULT_DEST } from './redirect-target'

/** Dónde aterriza el enlace del correo según el tipo. */
export const ATERRIZAJE = {
  invite: '/completar-perfil',
  recovery: '/recuperar/nueva-contrasena',
} as const

/**
 * El `next` que viaja dentro del enlace del correo, con el destino colgado.
 *
 * Se valida ACÁ y no solo al llegar porque este valor entra en una URL que
 * mandamos por correo: un destino externo convertiría el correo de Theos en un
 * trampolín a otro sitio. Lo que no sea una ruta interna se descarta y el
 * enlace queda como estaba.
 */
export function nextConDestino(aterrizaje: string, destino?: string | null): string {
  if (!destino || !isSafeDest(destino)) return aterrizaje
  // El destino ya se usó como ruta interna; `?redirect=` lo lleva codificado
  // para que su propio search (`/mis-pagos?pago=<id>`) no se mezcle con el
  // nuestro al parsear.
  return `${aterrizaje}?redirect=${encodeURIComponent(destino)}`
}

/**
 * A dónde se va la persona apenas guarda la contraseña.
 *
 * NUNCA al login: en ese momento ya tiene sesión. Va a donde iba, y si no venía
 * de ningún lado, al dashboard.
 */
export function destinoTrasGuardar(destino?: string | null): string {
  return safeDest(destino, DEFAULT_DEST)
}

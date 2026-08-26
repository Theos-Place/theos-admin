// EVE-1: deep link de inscripción desde el calendario público. El destino
// post-login abre el modal de inscripción del evento en /eventos (que verifica
// elegibilidad server-side, como el flujo normal). Módulo puro.

export function registerDeepLink(eventId: string): string {
  return `/eventos?register=${encodeURIComponent(eventId)}`
}

/** Login-gate: mismo patrón que /vacantes (postLoginDest valida el param). */
export function loginRedirectTo(dest: string): string {
  return `/login?redirect=${encodeURIComponent(dest)}`
}

/** La página PÚBLICA de un evento: lo que se comparte por link o QR.
 *
 *  Vive bajo /calendario porque ese prefijo ya es público en el proxy, así que
 *  no hay que abrir una ruta nueva al mundo — una decisión menos que revisar.
 */
export function publicEventPath(eventId: string): string {
  return `/calendario/${eventId}`
}

/** La URL absoluta, para copiar y para el QR. */
export function publicEventUrl(eventId: string, origin?: string): string {
  const base = origin
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? 'https://admin.theosplace.org'
  return `${base.replace(/\/$/, '')}${publicEventPath(eventId)}`
}

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

/**
 * A DÓNDE lleva "Inscribirme" dentro de la app.
 *
 * Si el evento tiene formulario de inscripción, inscribirse ES llenarlo: el
 * botón va al formulario y no al modal. Abrir el modal primero deja a la
 * persona inscrita SIN haber contestado nada, y después hay que perseguirla —
 * que es justo lo que el formulario venía a evitar.
 *
 * Es la misma regla que shareRegistrationUrl aplica al link para compartir. La
 * diferencia es que aquélla devuelve una URL absoluta (se copia y se pega) y
 * ésta una ruta relativa (se navega con el router).
 */
export function registerDestination(
  event: { id: string; registration_form_id?: string | null },
): string {
  return event.registration_form_id
    ? `/formularios/${event.registration_form_id}/responder`
    : registerDeepLink(event.id)
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

/**
 * EL link para compartir la inscripción a un evento.
 *
 * Si el evento tiene un FORMULARIO DE INSCRIPCIÓN asociado
 * (events.registration_form_id), el link es el del formulario: inscribirse ES
 * llenarlo. Repartir dos links distintos —uno "para inscribirse" y otro "para
 * llenar el formulario"— manda a la gente por un camino que después le pide lo
 * mismo otra vez, y deja dos listas que no calzan. Decisión 2026-08-27.
 *
 * Sin formulario, sigue el link público del evento de siempre.
 *
 * Ojo: el del formulario NO es anónimo (exige entrar con cuenta), igual que el
 * del evento. La diferencia es a dónde llega, no si pide login.
 */
export function shareRegistrationUrl(
  event: { id: string; registration_form_id?: string | null },
  origin?: string,
): { url: string; kind: 'formulario' | 'evento' } {
  const base = (origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org').replace(/\/$/, '')
  return event.registration_form_id
    ? { url: `${base}/formularios/${event.registration_form_id}/responder`, kind: 'formulario' }
    : { url: `${base}${publicEventPath(event.id)}`, kind: 'evento' }
}

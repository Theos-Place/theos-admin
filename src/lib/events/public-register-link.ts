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

/**
 * El link para compartir un formulario. Módulo puro.
 *
 * Apunta a /formularios/<id>/responder, que NO es una ruta anónima: exige
 * sesión, igual que la inscripción a un evento. Y está bien que sea así — una
 * respuesta queda ligada a la persona (para no dejar afuera a quien corrige la
 * suya, para saber si estaba convocada), así que no hay a dónde guardar una
 * respuesta sin dueño.
 *
 * Quien abra el link sin sesión cae en el login y VUELVE al formulario: el proxy
 * conserva el ?redirect= (se arregló el 2026-08-27; antes lo botaba para quien
 * ya tenía sesión y el link terminaba en el dashboard).
 */

/** Solo tiene sentido compartir un formulario ABIERTO y ACTIVO.
 *
 *  Si no está marcado "abierto a cualquiera con el link", formFillAccess lo
 *  rechaza con "Este formulario no está abierto para vos": repartir ese link es
 *  mandar gente a una puerta cerrada. Y si está inactivo, tampoco se puede
 *  responder. */
export function sePuedeCompartir(form: { is_public: boolean; is_active: boolean }): boolean {
  return form.is_public && form.is_active
}

export function formPath(formId: string): string {
  return `/formularios/${formId}/responder`
}

export function formShareUrl(formId: string, origin?: string): string {
  const base = origin
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? 'https://admin.theosplace.org'
  return `${base.replace(/\/$/, '')}${formPath(formId)}`
}

/**
 * El link para compartir un formulario. Módulo puro.
 *
 * Hay DOS links posibles y el formulario decide cuál:
 *
 *  · /formulario/<id>            — público, se contesta sin cuenta. Solo para
 *    los que están abiertos Y con requires_auth en false.
 *  · /formularios/<id>/responder — el de siempre: exige sesión. La respuesta
 *    queda ligada a la persona, que es lo que permite corregirla después y
 *    saber si estaba convocada.
 *
 * Quien abra el segundo sin sesión cae en el login y VUELVE al formulario: el
 * proxy conserva el ?redirect= (se arregló el 2026-08-27; antes lo botaba para
 * quien ya tenía sesión y el link terminaba en el dashboard).
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

/** La ruta pública: se contesta sin cuenta. Singular, para no chocar con el
 *  módulo /formularios (ver PUBLIC_PREFIXES en el proxy). */
export function publicFormPath(formId: string): string {
  return `/formulario/${formId}`
}

/**
 * EL link para compartir, y de qué tipo es.
 *
 * Si el formulario se puede contestar sin cuenta, ese es el link: repartir el
 * que pide login cuando existe uno abierto manda a la gente a un trámite que no
 * hace falta. Si no, el de siempre.
 *
 * Devuelve también `kind` para que la pantalla pueda decir cuál copió — no es
 * lo mismo pegar en WhatsApp un link que cualquiera abre que uno que pide
 * cuenta, y quien comparte tiene que saber cuál mandó.
 */
export function formShareLink(
  form: { id: string; is_public: boolean; requires_auth?: boolean },
  origin?: string,
): { url: string; kind: 'publico' | 'con-cuenta' } {
  const base = (origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org').replace(/\/$/, '')
  const abierto = form.is_public && form.requires_auth === false
  return abierto
    ? { url: `${base}${publicFormPath(form.id)}`, kind: 'publico' }
    : { url: `${base}${formPath(form.id)}`, kind: 'con-cuenta' }
}

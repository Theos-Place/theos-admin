// Qué páginas se pueden meter en un iframe de otro sitio, y desde dónde.
//
// EL PROBLEMA. /eventos/embed genera el código de un iframe para pegar en el
// sitio de Theos, pero el header `X-Frame-Options: SAMEORIGIN` bloqueaba
// cualquier embed fuera de este dominio: la función existía y nunca podía
// funcionar. (La vista previa dentro del admin sí anda, porque es mismo
// origen — por eso pasó desapercibido.)
//
// LA SOLUCIÓN NO ES SACAR EL HEADER. Se abre SOLO lo que tiene sentido embeber
// y SOLO a los orígenes que se configuren. El resto del sistema —el padrón, las
// finanzas, los formularios— sigue bloqueado: dejarlo embebible habilita
// clickjacking sobre acciones que hace alguien con sesión.
//
// X-Frame-Options no sabe expresar una lista de orígenes (ALLOW-FROM está
// muerto y ningún browser moderno lo respeta), así que en esas rutas se quita y
// manda `frame-ancestors` de la CSP, que sí.

/** Prefijos embebibles. Son páginas PÚBLICAS de solo lectura: no hay nada que
 *  alguien con sesión pueda hacer sin querer dentro de un iframe ajeno. */
export const EMBEDDABLE_PREFIXES = ['/calendario']

export function esEmbebible(pathname: string): boolean {
  return EMBEDDABLE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/**
 * Los orígenes autorizados, de la variable EMBED_ALLOWED_ORIGINS.
 *
 * Va por configuración y no en el código porque el dominio del sitio no es una
 * decisión de programación, y porque Preview y producción pueden diferir.
 * Formato: separados por coma. Ej:
 *   EMBED_ALLOWED_ORIGINS="https://theosplace.com,https://www.theosplace.com"
 *
 * Se descarta lo que no sea un origen http(s) completo: un valor a medias
 * ("theosplace.com") en frame-ancestors no falla ruidosamente, simplemente no
 * matchea, y quedaría el iframe roto sin que nadie sepa por qué.
 */
export function origenesPermitidos(raw = process.env.EMBED_ALLOWED_ORIGINS): string[] {
  return (raw ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => {
      try {
        const u = new URL(s)
        return (u.protocol === 'https:' || u.protocol === 'http:') && u.origin === s.replace(/\/$/, '')
      } catch { return false }
    })
}

/**
 * El valor de `frame-ancestors` para una ruta.
 *
 * Fuera de las embebibles va `'self'`, que es lo mismo que decía
 * X-Frame-Options: SAMEORIGIN. En las embebibles, `'self'` más los orígenes
 * configurados — y si no hay ninguno configurado, queda igual que antes, o sea
 * que activar esto no abre nada por sí solo.
 */
export function frameAncestors(pathname: string, origenes = origenesPermitidos()): string {
  if (!esEmbebible(pathname) || origenes.length === 0) return "frame-ancestors 'self'"
  return `frame-ancestors 'self' ${origenes.join(' ')}`
}

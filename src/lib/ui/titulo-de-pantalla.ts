/**
 * QA-1/N4 · El título de la pestaña de una pantalla concreta.
 *
 * POR QUÉ NO ES `metadata`. `export const metadata` solo funciona en un
 * componente de SERVIDOR, y **112 de las 132 páginas de esta app son
 * `'use client'`** porque viven de hooks. Por eso el título lo declaran los
 * layouts de módulo (B13) y todas las pantallas de un módulo comparten uno:
 * las 23 de estudios se llaman «Estudios», y en el historial o en una pestaña
 * anclada no se distinguen.
 *
 * Darle un layout de servidor propio a cada una serían 112 archivos nuevos que
 * no hacen nada más que eso. La salida es escribir `document.title`, que es
 * exactamente lo que el navegador guarda en el historial.
 *
 * SE AUTOCORRIGE al navegar: si la pantalla siguiente no usa el hook, Next le
 * pone el título de su layout igual. O sea que esto no deja un título viejo
 * pegado; solo agrega detalle donde hace falta.
 *
 * La composición es pura para poder fijarla con tests — tiene que dar lo mismo
 * que la plantilla `%s | Theos Place` del layout raíz, o el título de una
 * pantalla se vería distinto según quién lo puso.
 */

export const SUFIJO = 'Theos Place'

/**
 * @param propio   lo que distingue a ESTA pantalla («Grupo Discípulos 2»).
 * @param seccion  el módulo, opcional («Estudios»). Va en medio para que el
 *   principio del título —que es lo único que se ve en una pestaña angosta—
 *   sea lo específico y no el nombre del módulo repetido.
 *
 * Vacío o en blanco devuelve el título base, nunca " | Theos Place" suelto.
 */
export function tituloDePantalla(propio: string, seccion?: string): string {
  const partes = [propio.trim(), seccion?.trim()].filter(Boolean)
  if (partes.length === 0) return SUFIJO
  return `${partes.join(' · ')} | ${SUFIJO}`
}

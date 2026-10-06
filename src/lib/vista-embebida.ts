/**
 * ¿Esta página se está mostrando DENTRO de un iframe de otro sitio?
 *
 * EL PROBLEMA (2026-10-06). El calendario y la cartelera de puestos se
 * embeben en theosplace.org, y cada una trae su propia banda de encabezado
 * —«Theos Place — Eventos», «Oportunidades de servicio»—. Dentro del sitio,
 * que ya tiene su header, se ven DOS encabezados pegados y la página parece
 * mal armada.
 *
 * SE OCULTA EL ENCABEZADO, no se borra. La página suelta sigue necesitándolo:
 * quien abre admin.theosplace.org/puestos directo —desde un link de WhatsApp,
 * por ejemplo— llegaría a una lista sin título ni contexto.
 *
 * POR PARÁMETRO Y NO DETECTANDO EL IFRAME. `window.self !== window.top` suena
 * más listo y es peor: no existe al renderizar en el servidor, así que el
 * encabezado se pinta y después desaparece — un parpadeo en CADA carga, para
 * todo el mundo. El parámetro se decide antes de pintar nada.
 *
 * Módulo PURO.
 */

/** El parámetro que lo activa. `?embed=1` en la URL del iframe. */
export const PARAM_EMBEBIDO = 'embed'

/**
 * Acepta `1` y `true`, que es lo que alguien escribe a mano sin pensarlo.
 * Cualquier otra cosa —incluido el parámetro vacío— es «no»: un `?embed=` a
 * medias no debería esconder nada sin que se note.
 */
export function esVistaEmbebida(valor: string | null | undefined): boolean {
  return valor === '1' || valor === 'true'
}

/** La URL del iframe, con el parámetro ya puesto. */
export function urlParaEmbeber(base: string): string {
  const sep = base.includes('?') ? '&' : '?'
  return base.includes(`${PARAM_EMBEBIDO}=`) ? base : `${base}${sep}${PARAM_EMBEBIDO}=1`
}

'use client'
import { useCallback, useRef } from 'react'

/**
 * Una página embebida en theosplace.org le avisa al sitio cuánto mide, para
 * que el iframe crezca con el contenido y no tenga scroll propio (2026-10-15,
 * pedido de Floriana: «se nota mucho que es iframe»).
 *
 * El iframe no puede cambiar su propio alto: lo decide la página que lo
 * contiene. Esto manda `{ tipo: 'theos:altura', alto, pagina }` con
 * postMessage cada vez que el contenido cambia de tamaño, y el sitio, con el
 * fragmento de `docs/embeber-en-el-sitio.md`, le pone ese alto.
 *
 * SE MIDE EL CONTENEDOR DE LA PÁGINA, no el documento. Medir `body` o `html`
 * no sirve: el CSS global les da `min-height: 100%`, y adentro del iframe el
 * 100% ES el iframe. El iframe no podía achicarse nunca, y con `min-h-screen`
 * en la página crecía sin fin (17.000 px en la prueba). Por lo mismo, la
 * página embebida no puede usar `min-h-screen`, `h-screen` ni `100vh`.
 *
 * Se manda a cualquier origen ('*') a propósito: el mensaje solo lleva un
 * número y una ruta pública. Quien recibe sí tiene que mirar de dónde viene.
 *
 * Devuelve el ref para el contenedor.
 */
export function useAlturaParaElSitio(activo: boolean) {
  const ro = useRef<ResizeObserver | null>(null)
  return useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect()
    ro.current = null
    if (!el || !activo || window.parent === window) return
    let ultimo = 0
    const avisar = () => {
      const alto = Math.ceil(el.getBoundingClientRect().height)
      if (alto === ultimo) return
      ultimo = alto
      window.parent.postMessage({ tipo: 'theos:altura', alto, pagina: window.location.pathname }, '*')
    }
    ro.current = new ResizeObserver(avisar)
    ro.current.observe(el)
    avisar()
  }, [activo])
}

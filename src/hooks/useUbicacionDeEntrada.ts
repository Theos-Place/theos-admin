'use client'

import { useSyncExternalStore } from 'react'

/**
 * LINT-1 · La URL con la que se ENTRÓ a la página (search y hash), leída sin
 * efecto y sin romper la hidratación.
 *
 * El patrón que reemplaza: `useEffect(() => { const p = new URLSearchParams(
 * window.location.search); if (p.get('filter') === 'x') setFiltro(...) }, [])`.
 * Ese `setState` síncrono en el efecto es lo que marca el linter, y leer
 * `window` directo en el render rompe la hidratación (el servidor no tiene
 * URL con fragmento ni query garantizados).
 *
 * `useSyncExternalStore` resuelve las dos cosas: en el servidor y durante la
 * hidratación devuelve '' (el snapshot de servidor), y en el primer render
 * del cliente ya trae la URL real. Con eso, `usePrecarga(search || null, …)`
 * vuelca el filtro ANTES de pintar, como cualquier otra precarga.
 *
 * No se suscribe a cambios: es la URL DE ENTRADA, no un estado vivo. Para
 * seguir la URL en vivo está `useUrlFilter`.
 */
const nadie = () => () => {}

export function useUbicacionDeEntrada(): { search: string; hash: string } {
  const search = useSyncExternalStore(nadie, () => window.location.search, () => '')
  const hash = useSyncExternalStore(nadie, () => window.location.hash, () => '')
  return { search, hash }
}

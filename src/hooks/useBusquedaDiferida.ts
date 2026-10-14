'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { claveDeBusqueda, estadoDeBusqueda, type Guardado } from '@/lib/hooks/busqueda-diferida'

/**
 * LINT-1 · Buscar mientras se escribe, con debounce, sin `setState` en el efecto.
 *
 *     const { resultados, buscando } = useBusquedaDiferida(query, (q, signal) =>
 *       fetch(`/api/members/lookup?search=${encodeURIComponent(q)}`, { signal })
 *         .then(r => (r.ok ? r.json() : { members: [] }))
 *         .then(d => d.members ?? []),
 *     )
 *
 * La regla —qué se muestra y cuándo «está buscando»— vive en
 * `lib/hooks/busqueda-diferida`, pura y con tests. Acá queda el cableado.
 *
 * @param consulta lo que escribió la persona; se recorta acá.
 * @param buscar   qué pedir. NO hace falta que sea estable: viaja por ref, para
 *   que quien llama no tenga que envolverla en `useCallback`. Recibe un
 *   `AbortSignal` que se dispara si la consulta cambia antes de la respuesta.
 * @param opciones `minimo` de caracteres (2), `espera` en ms (300), `activa`
 *   (true) para apagarla —p. ej. con el modal cerrado—, y `dependencias`, un
 *   string que al cambiar vuelve a buscar con la misma consulta (una lista de
 *   excluidos, un id).
 */
export function useBusquedaDiferida<T>(
  consulta: string,
  buscar: (q: string, signal: AbortSignal) => Promise<T[]>,
  opciones: { minimo?: number; espera?: number; activa?: boolean; dependencias?: string } = {},
): { resultados: T[]; buscando: boolean; setResultados: (f: (prev: T[]) => T[]) => void } {
  const { minimo = 2, espera = 300, activa = true, dependencias = '' } = opciones
  const clave = claveDeBusqueda(consulta, minimo, activa)
  // La clave guardada lleva las dependencias: cambiar la lista de excluidos
  // con la misma consulta tiene que volver a pedir.
  const claveCompleta = clave === '' ? '' : `${clave}\u0000${dependencias}`
  const [guardado, setGuardado] = useState<Guardado<T> | null>(null)

  const buscarRef = useRef(buscar)
  useEffect(() => { buscarRef.current = buscar })

  useEffect(() => {
    if (claveCompleta === '') return
    const q = claveCompleta.split('\u0000')[0]
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      buscarRef.current(q, ctrl.signal)
        .then(resultados => { if (!ctrl.signal.aborted) setGuardado({ clave: claveCompleta, resultados }) })
        .catch(() => { if (!ctrl.signal.aborted) setGuardado({ clave: claveCompleta, resultados: [] }) })
    }, espera)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [claveCompleta, espera])

  /** Ajustar lo que se muestra sin volver a pedir (quitar al que ya se agregó,
   *  marcarle un dato a alguien). Solo toca lo guardado para ESTA consulta. */
  const setResultados = useCallback((f: (prev: T[]) => T[]) => {
    setGuardado(g => (g ? { ...g, resultados: f(g.resultados) } : g))
  }, [])

  return { ...estadoDeBusqueda(claveCompleta, guardado), setResultados }
}

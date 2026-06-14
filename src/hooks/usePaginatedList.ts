import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Paginación server-side acumulativa, genérica. Espejo de `useMembers` pero sin
 * acoplarse a un endpoint concreto: se le pasa `buildUrl(page)` y, opcionalmente,
 * un `mapItem` para adaptar la fila cruda al tipo de dominio.
 *
 * - `buildUrl(page)` devuelve la URL de esa página, o `null` para DESHABILITAR
 *   (lista vacía sin fetch — ej. tablas que esperan una búsqueda).
 * - Resetea a la página 1 cuando cambia la URL base (cambian filtros/búsqueda).
 * - Acumula con `loadMore()` (no reemplaza).
 *
 * El endpoint debe devolver `{ [itemsKey]: Raw[]; total: number }` con `total`
 * como conteo exacto post-filtros (count: 'exact').
 */
export function usePaginatedList<Raw, T = Raw>(
  buildUrl: (page: number) => string | null,
  opts: {
    pageSize?: number
    itemsKey?: string
    mapItem?: (raw: Raw) => T
  } = {},
) {
  const { pageSize = 50, itemsKey = 'items', mapItem } = opts
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [nonce, setNonce]     = useState(0)
  /** Re-pide la primera página (para reintentar tras un error). */
  const reload = useCallback(() => setNonce(n => n + 1), [])

  // mapItem suele ser una arrow inline → no estabilizada. La guardamos en ref
  // para no re-disparar el efecto en cada render por su identidad.
  const mapRef = useRef(mapItem)
  mapRef.current = mapItem
  const map = useCallback((rows: Raw[]): T[] => {
    const fn = mapRef.current
    return fn ? rows.map(fn) : (rows as unknown as T[])
  }, [])

  const key = buildUrl(1)

  // Primera página: corre cuando cambia la URL base (key) o se deshabilita.
  useEffect(() => {
    if (key === null) { setItems([]); setTotal(0); setPage(1); setError(null); setLoading(false); return }
    let cancelled = false
    setLoading(true); setError(null)
    fetch(key)
      .then(r => { if (!r.ok) throw new Error('Error cargando datos'); return r.json() })
      .then((d: Record<string, unknown>) => {
        if (cancelled) return
        setItems(map((d[itemsKey] as Raw[]) ?? []))
        setTotal((d.total as number) ?? 0)
        setPage(1)
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [key, itemsKey, map, nonce])

  const loadMore = useCallback(async () => {
    const next = page + 1
    const url = buildUrl(next)
    if (url === null) return
    setLoading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error cargando más')
      const d = (await res.json()) as Record<string, unknown>
      setItems(prev => [...prev, ...map((d[itemsKey] as Raw[]) ?? [])])
      setTotal((d.total as number) ?? 0)
      setPage(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
    // buildUrl es nueva en cada render; dependemos de page (y key, vía cierre).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, key, map, itemsKey])

  const hasMore = items.length < total

  return { items, total, page, loading, error, hasMore, loadMore, reload, pageSize }
}

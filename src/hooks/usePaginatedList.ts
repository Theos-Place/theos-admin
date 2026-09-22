'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { selloDeCarga, mensajeDeError } from '@/lib/hooks/estado-de-carga'
import { estadoDeLista, sumarPagina, type ListaGuardada } from '@/lib/hooks/lista-paginada'

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
 *
 * LINT-1 (2026-09-22): "cargando" se DERIVA del sello, no se enciende a mano al
 * entrar al efecto. La regla vive en `lib/hooks/lista-paginada.ts`, con tests;
 * acá queda el cableado. La API pública no cambió, así que ninguna pantalla se
 * tocó.
 *
 * `loadingMore` es aparte de `loading` a propósito: traer la primera página
 * deja la pantalla sin nada que enseñar, traer la siguiente no. Con una sola
 * bandera, "cargar más" vaciaba la tabla y la volvía a pintar.
 */
export function usePaginatedList<Raw, T = Raw, E = undefined>(
  buildUrl: (page: number) => string | null,
  opts: {
    pageSize?: number
    itemsKey?: string
    mapItem?: (raw: Raw) => T
    /** Lo que el endpoint manda AL LADO de la lista y vale para el filtro
     *  entero (una suma, un conteo). Se lee de la página 1 y viaja con el
     *  sello, así que nunca se ve el valor de un filtro junto a la lista de
     *  otro. */
    leerExtra?: (payload: Record<string, unknown>) => E
  } = {},
) {
  const { pageSize = 50, itemsKey = 'items', mapItem, leerExtra } = opts
  const [guardado, setGuardado] = useState<ListaGuardada<T, E> | null>(null)
  const [intento, setIntento] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const key = buildUrl(1)
  const sello = selloDeCarga(key ?? '(deshabilitado)', intento)

  // mapItem suele ser una arrow inline → cambia de identidad en cada render y
  // re-dispararía el efecto, así que viaja por ref. La escritura va en un
  // EFECTO y no en el render: mutar una ref durante el render es justo lo que
  // React pide no hacer.
  const mapRef = useRef(mapItem)
  useEffect(() => { mapRef.current = mapItem })
  const map = useCallback((rows: Raw[]): T[] => {
    const fn = mapRef.current
    return fn ? rows.map(fn) : (rows as unknown as T[])
  }, [])

  // `buildUrl` también por ref: es una arrow nueva en cada render, y `loadMore`
  // la necesita sin que eso lo vuelva inestable.
  const urlRef = useRef(buildUrl)
  useEffect(() => { urlRef.current = buildUrl })

  const itemsKeyRef = useRef(itemsKey)
  useEffect(() => { itemsKeyRef.current = itemsKey })

  const extraRef = useRef(leerExtra)
  useEffect(() => { extraRef.current = leerExtra })

  const leer = useCallback(async (url: string) => {
    const r = await fetch(url)
    if (!r.ok) throw new Error('Error cargando datos')
    const d = (await r.json()) as Record<string, unknown>
    return {
      items: map((d[itemsKeyRef.current] as Raw[]) ?? []),
      total: (d.total as number) ?? 0,
      extra: extraRef.current ? extraRef.current(d) : (undefined as E),
    }
  }, [map])

  useEffect(() => {
    if (key === null) {
      // Deshabilitado: se marca como "llegado y vacío" con el sello actual, así
      // `cargando` queda en false. Antes esto eran cinco setState seguidos.
      setGuardado({ sello, items: [], total: 0, pagina: 1, error: null })
      return
    }
    let vivo = true
    leer(key)
      .then(({ items, total, extra }) => {
        if (vivo) setGuardado({ sello, items, total, pagina: 1, error: null, extra })
      })
      .catch(e => {
        if (vivo) setGuardado({ sello, items: [], total: 0, pagina: 1, error: mensajeDeError(e, 'Error desconocido') })
      })
    return () => { vivo = false }
  }, [sello, key, leer])

  const estado = estadoDeLista(sello, guardado)

  const loadMore = useCallback(async () => {
    const actual = guardado
    if (!actual || actual.sello !== sello) return
    const siguiente = actual.pagina + 1
    const url = urlRef.current(siguiente)
    if (url === null) return
    setLoadingMore(true)
    try {
      const { items, total } = await leer(url)
      // `sumarPagina` descarta la respuesta si cambió el sello mientras venía
      // en camino o si no es la página siguiente. Por eso se pasa el guardado
      // de ese momento y no el de la ref.
      setGuardado(prev => sumarPagina(prev, { sello, items, total, pagina: siguiente }) ?? prev)
    } catch (e) {
      setGuardado(prev => (prev ? { ...prev, error: mensajeDeError(e, 'Error cargando más') } : prev))
    } finally {
      setLoadingMore(false)
    }
  }, [guardado, sello, leer])

  /** Re-pide la primera página (para reintentar tras un error). */
  const reload = useCallback(() => setIntento(n => n + 1), [])

  return {
    items: estado.items,
    total: estado.total,
    extra: estado.extra,
    page: estado.pagina,
    // Quien consume esto espera UN booleano de "está trabajando".
    loading: estado.cargando || loadingMore,
    loadingMore,
    error: estado.error,
    hasMore: estado.hayMas,
    loadMore,
    reload,
    pageSize,
  }
}

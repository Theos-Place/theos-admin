import { useState, useEffect, useCallback } from 'react'

/**
 * Paginación de VISTA para datasets chicos/acotados que ya viven en memoria por
 * diseño (catálogos, listas filtradas client-side). No rehace ningún fetch: solo
 * muestra `pageSize` items y acumula con "Cargar más".
 *
 * Resetea a la primera página cuando cambia la longitud o la identidad del array
 * (típicamente al cambiar filtros/búsqueda, que producen un array nuevo).
 */
export function useClientPagination<T>(items: T[], pageSize = 25) {
  const [visibleCount, setVisibleCount] = useState(pageSize)

  // Reset al cambiar el conjunto (filtros/búsqueda → nuevo array).
  useEffect(() => { setVisibleCount(pageSize) }, [items, pageSize])

  const loadMore = useCallback(() => setVisibleCount(c => c + pageSize), [pageSize])

  const visible = items.slice(0, visibleCount)
  return {
    visible,
    shown: visible.length,
    total: items.length,
    hasMore: visibleCount < items.length,
    loadMore,
    pageSize,
  }
}

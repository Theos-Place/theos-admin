'use client'

import { useState, useCallback, useMemo } from 'react'

/** Selección múltiple genérica para listas (dirigentes, miembros, puestos, …).
 *  Maneja el set de ids seleccionados; `allIds` es el universo seleccionable
 *  actual (p. ej. los resultados filtrados) para "seleccionar todos". */
export function useRowSelection<T extends string = string>(allIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set())

  const toggle = useCallback((id: T) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  // Selecciona/limpia TODO el universo `allIds`.
  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const allSelected = allIds.length > 0 && allIds.every(id => prev.has(id))
      return allSelected ? new Set() : new Set(allIds)
    })
  }, [allIds])

  const isSelected = useCallback((id: T) => selected.has(id), [selected])

  const allSelected = useMemo(
    () => allIds.length > 0 && allIds.every(id => selected.has(id)),
    [allIds, selected],
  )
  const someSelected = selected.size > 0 && !allSelected

  // Solo los seleccionados que siguen en el universo vigente (evita ids "huérfanos"
  // tras cambiar filtros).
  const selectedIds = useMemo(() => allIds.filter(id => selected.has(id)), [allIds, selected])

  return { selected, selectedIds, count: selectedIds.length, toggle, toggleAll, clear, isSelected, allSelected, someSelected }
}

'use client'

import { useState, useEffect } from 'react'

export type EventTypeOption = { id: string; name: string; color: string; icon: string }

// El catálogo de tipos cambia rarísimo: caché de módulo para no refetch en cada
// montaje. La fuente es la BD (/api/events/types) — si se agrega un tipo nuevo,
// aparece automáticamente en los filtros de todas las vistas.
let cache: EventTypeOption[] | null = null

/** Tipos de evento ACTIVOS desde la BD (no el mock). Para los filtros. */
export function useEventTypes() {
  const [types, setTypes] = useState<EventTypeOption[]>(() => cache ?? [])

  useEffect(() => {
    if (cache) { setTypes(cache); return }
    let alive = true
    fetch('/api/events/types')
      .then(r => (r.ok ? r.json() : []))
      .then((d: EventTypeOption[]) => {
        if (!alive) return
        const active = (Array.isArray(d) ? d : []).filter(t => (t as { is_active?: boolean }).is_active !== false)
        cache = active
        setTypes(active)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return types
}

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

export type EventTypeOption = { id: string; name: string; color: string; icon: string }

// Fallback (hex) por si el catálogo aún no cargó o el tipo no existe. La fuente
// real es la BD (event_types): tipos nuevos creados por admins traen su propio
// color/nombre y aparecen solos, sin tocar código.
const FALLBACK_TYPES: Record<string, { label: string; color: string }> = {
  charla:       { label: 'Charla',           color: '#161440' },
  campamento:   { label: 'Campamento',       color: '#F59E0B' },
  social:       { label: 'Actividad Social', color: '#C43635' },
  capacitacion: { label: 'Capacitación',     color: '#3B7579' },
  taller:       { label: 'Taller',           color: '#8B5CF6' },
}

/** Resolver de estilo de un tipo de evento: { label, color(hex) } desde el catálogo
 *  de la BD; si el tipo no está (o no cargó), cae a un fallback y, por último, a
 *  navy con el slug como etiqueta. Escala a tipos custom creados por admins. */
export function useEventTypeStyle() {
  const types = useEventTypes()
  const map = useMemo(() => new Map(types.map(t => [t.id, t])), [types])
  return useCallback((type: string): { label: string; color: string } => {
    const t = map.get(type)
    if (t) return { label: t.name, color: t.color }
    return FALLBACK_TYPES[type] ?? { label: type || 'Evento', color: '#161440' }
  }, [map])
}

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

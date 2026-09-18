'use client'

import { useMemo, useCallback } from 'react'
import { useCargaRemota } from './useCargaRemota'

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

const NINGUNO: EventTypeOption[] = []

/** Tipos de evento ACTIVOS desde la BD (no el mock). Para los filtros. */
export function useEventTypes() {
  // LINT-1: el `setState` síncrono era el del caché (`if (cache) setTypes(cache)`).
  // Ahora el caché se lee DENTRO de la carga, que ya es asíncrona, y "cargando"
  // lo deriva useCargaRemota. Quien consume esto solo quiere la lista.
  const { datos } = useCargaRemota<EventTypeOption[]>('event-types', async () => {
    if (cache) return cache
    const r = await fetch('/api/events/types')
    const d = (r.ok ? await r.json() : []) as EventTypeOption[]
    cache = (Array.isArray(d) ? d : []).filter(t => (t as { is_active?: boolean }).is_active !== false)
    return cache
  })
  // Constante: `?? []` daría un array nuevo por render y cualquier efecto de
  // quien lo consuma entraría en bucle.
  return datos ?? NINGUNO
}

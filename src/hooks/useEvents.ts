import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbEventEnriched } from '@/lib/supabase/queries/events'
import { toDomainEvent } from '@/lib/events/adapter'
import type { AdminEvent, EventType, EventStatus } from '@/types/event'

type Filters = {
  search?: string
  event_type?: EventType
  status?: EventStatus
  is_active?: boolean
}

export function useEvents(filters: Filters = {}, opts: { enabled?: boolean } = {}) {
  // SEC-1: `enabled:false` evita el fetch (p. ej. dashboard de miembro, que
  // recibiría 403 de /api/events y solo ensuciaría la consola).
  const enabled = opts.enabled ?? true
  const [dbEvents, setDbEvents] = useState<DbEventEnriched[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.search)                  params.set('search', filters.search)
      if (filters.event_type)              params.set('event_type', filters.event_type)
      if (filters.status)                  params.set('status', filters.status)
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active))
      params.set('pageSize', '500') // cargamos todo para mantener filtros client-side

      const res = await fetch(`/api/events?${params}`)
      if (!res.ok) throw new Error('Error cargando eventos')
      const data = await res.json()
      setDbEvents(data.events)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [filters.search, filters.event_type, filters.status, filters.is_active])

  useEffect(() => { if (enabled) fetchEvents() }, [enabled, fetchEvents])

  const events: AdminEvent[] = useMemo(
    () => dbEvents.map(toDomainEvent),
    [dbEvents],
  )

  return { events, total, loading, error, refetch: fetchEvents }
}

/** Eventos PUBLICADOS para el calendario público (/calendario, sin sesión).
 *  Pega al endpoint público — /api/events exige sesión y dejaba el widget vacío. */
export function usePublicEvents() {
  const [dbEvents, setDbEvents] = useState<DbEventEnriched[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/events')
      .then(res => {
        if (!res.ok) throw new Error('Error cargando eventos')
        return res.json()
      })
      .then(data => { if (!cancelled) setDbEvents(data.events) })
      .catch(e => { console.error('usePublicEvents:', e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const events: AdminEvent[] = useMemo(
    () => dbEvents.map(toDomainEvent),
    [dbEvents],
  )

  return { events, loading }
}

/** TODOS los eventos (activos + históricos) en versión liviana — sin
 *  registrations/checkins/volunteers. Para el calendario y el filtro
 *  "Realizados", donde solo hacen falta título, fechas y recurrencia. */
export function useAllEventsLight() {
  const [dbEvents, setDbEvents] = useState<DbEventEnriched[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/events?light=1&is_active=all&pageSize=2000')
      .then(res => {
        if (!res.ok) throw new Error('Error cargando eventos')
        return res.json()
      })
      .then(data => { if (!cancelled) setDbEvents(data.events) })
      .catch(e => { console.error('useAllEventsLight:', e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const events: AdminEvent[] = useMemo(
    () => dbEvents.map(toDomainEvent),
    [dbEvents],
  )

  return { events, loading }
}

/** Carga un evento individual por id (detalle). */
export function useEvent(id: string | null) {
  const [dbEvent, setDbEvent] = useState<DbEventEnriched | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchEvent = useCallback(async () => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/${id}`)
      if (res.status === 404) { setDbEvent(null); return }
      if (!res.ok) throw new Error('Error cargando el evento')
      setDbEvent(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchEvent() }, [fetchEvent])

  const event: AdminEvent | null = useMemo(
    () => (dbEvent ? toDomainEvent(dbEvent) : null),
    [dbEvent],
  )

  return { event, loading, error, refetch: fetchEvent }
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbEventEnriched } from '@/lib/supabase/queries/events'
import { toDomainEvent } from '@/lib/events/adapter'
import type { MockEvent, EventType, EventStatus } from '@/types/event'

type Filters = {
  search?: string
  event_type?: EventType
  status?: EventStatus
  is_active?: boolean
}

export function useEvents(filters: Filters = {}) {
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

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const events: MockEvent[] = useMemo(
    () => dbEvents.map(toDomainEvent),
    [dbEvents],
  )

  return { events, total, loading, error, refetch: fetchEvents }
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

  const event: MockEvent | null = useMemo(
    () => (dbEvent ? toDomainEvent(dbEvent) : null),
    [dbEvent],
  )

  return { event, loading, error, refetch: fetchEvent }
}

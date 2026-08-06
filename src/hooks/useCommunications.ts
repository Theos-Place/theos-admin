import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbBroadcast, DbTemplate, DbChannelConfig } from '@/lib/supabase/queries/communications'
import { toDomainMessage, toDomainTemplate, toDomainChannelConfig } from '@/lib/communications/adapter'
import type { CommunicationMessage, MessageTemplate, ChannelConfig } from '@/types/communication'

import {
  readCommsCache, writeCommsCache, invalidateCommsCache, type CommsSlice,
} from '@/lib/communications/comms-cache'

export type { CommsSlice }
export { invalidateCommsCache }

const ENDPOINT: Record<CommsSlice, string> = {
  messages: '/api/communications/messages',
  templates: '/api/communications/templates',
  configs: '/api/communications/configs',
}

// La caché vive en @/lib/communications/comms-cache para que las pantallas que
// ESCRIBEN puedan invalidarla sin importar este hook. refetch() la salta.

/** Datos de comunicaciones por slice. Sin argumentos trae todo (compatibilidad). */
export function useCommunications(...slices: CommsSlice[]) {
  const wantedKey = (slices.length ? slices : (['messages', 'templates', 'configs'] as CommsSlice[])).join(',')

  const [dbMessages, setDbMessages]   = useState<DbBroadcast[]>([])
  const [dbTemplates, setDbTemplates] = useState<DbTemplate[]>([])
  const [dbConfigs, setDbConfigs]     = useState<DbChannelConfig[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const fetchAll = useCallback(async (force = false) => {
    const want = wantedKey.split(',') as CommsSlice[]
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(want.map(async (slice): Promise<[CommsSlice, unknown[]]> => {
        const hit = force ? null : readCommsCache(slice)
        if (hit) return [slice, hit]
        const res = await fetch(ENDPOINT[slice])
        if (!res.ok) throw new Error('Error cargando comunicaciones')
        const rows = (await res.json()) as unknown[]
        writeCommsCache(slice, rows)
        return [slice, rows]
      }))
      for (const [slice, rows] of results) {
        if (slice === 'messages') setDbMessages(rows as DbBroadcast[])
        else if (slice === 'templates') setDbTemplates(rows as DbTemplate[])
        else setDbConfigs(rows as DbChannelConfig[])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [wantedKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  const refetch = useCallback(() => fetchAll(true), [fetchAll])

  const messages: CommunicationMessage[] = useMemo(() => dbMessages.map(toDomainMessage), [dbMessages])
  const templates: MessageTemplate[]     = useMemo(() => dbTemplates.map(toDomainTemplate), [dbTemplates])
  const configs: ChannelConfig[]         = useMemo(() => dbConfigs.map(toDomainChannelConfig), [dbConfigs])

  return { messages, templates, configs, loading, error, refetch }
}

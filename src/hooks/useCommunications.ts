import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbBroadcast, DbTemplate, DbChannelConfig } from '@/lib/supabase/queries/communications'
import { toDomainMessage, toDomainTemplate, toDomainChannelConfig } from '@/lib/communications/adapter'
import type { CommunicationMessage, MessageTemplate, ChannelConfig } from '@/types/communication'

export function useCommunications() {
  const [dbMessages, setDbMessages]   = useState<DbBroadcast[]>([])
  const [dbTemplates, setDbTemplates] = useState<DbTemplate[]>([])
  const [dbConfigs, setDbConfigs]     = useState<DbChannelConfig[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, t, c] = await Promise.all([
        fetch('/api/communications/messages'),
        fetch('/api/communications/templates'),
        fetch('/api/communications/configs'),
      ])
      if (![m, t, c].every((r) => r.ok)) throw new Error('Error cargando comunicaciones')
      setDbMessages(await m.json())
      setDbTemplates(await t.json())
      setDbConfigs(await c.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const messages: CommunicationMessage[] = useMemo(() => dbMessages.map(toDomainMessage), [dbMessages])
  const templates: MessageTemplate[]     = useMemo(() => dbTemplates.map(toDomainTemplate), [dbTemplates])
  const configs: ChannelConfig[]         = useMemo(() => dbConfigs.map(toDomainChannelConfig), [dbConfigs])

  return { messages, templates, configs, loading, error, refetch: fetchAll }
}

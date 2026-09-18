import { useCallback, useMemo, useRef } from 'react'
import { useCargaRemota } from './useCargaRemota'

/** Lo que trae una carga completa. La constante vacía evita que un `?? {...}`
 *  cambie de identidad en cada render. */
type Datos = { messages: DbBroadcast[]; templates: DbTemplate[]; configs: DbChannelConfig[] }
const NINGUNO: Datos = { messages: [], templates: [], configs: [] }
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

  /**
   * LINT-1 · Sin `setLoading` dentro del efecto: "cargando" lo deriva
   * useCargaRemota del sello de la petición.
   *
   * `forzar` viaja por ref porque no es un parámetro de la consulta —no cambia
   * QUÉ se pide, solo si se ignora el caché—, así que no puede ir en la clave:
   * si fuera parte de ella, volvería a cargar sola al apagarse.
   */
  const forzarRef = useRef(false)
  const { datos, cargando, error, recargar } = useCargaRemota<Datos>(wantedKey, async () => {
    const forzar = forzarRef.current
    forzarRef.current = false
    const want = wantedKey.split(',') as CommsSlice[]
    const results = await Promise.all(want.map(async (slice): Promise<[CommsSlice, unknown[]]> => {
      const hit = forzar ? null : readCommsCache(slice)
      if (hit) return [slice, hit]
      const res = await fetch(ENDPOINT[slice])
      if (!res.ok) throw new Error('Error cargando comunicaciones')
      const rows = (await res.json()) as unknown[]
      writeCommsCache(slice, rows)
      return [slice, rows]
    }))
    const out: Datos = { messages: [], templates: [], configs: [] }
    for (const [slice, rows] of results) {
      if (slice === 'messages') out.messages = rows as DbBroadcast[]
      else if (slice === 'templates') out.templates = rows as DbTemplate[]
      else out.configs = rows as DbChannelConfig[]
    }
    return out
  })

  // Devuelve la promesa: hay pantallas que hacen `await refetch()` y recién
  // después navegan.
  const refetch = useCallback(() => { forzarRef.current = true; return recargar() }, [recargar])

  const d = datos ?? NINGUNO
  const messages: CommunicationMessage[] = useMemo(() => d.messages.map(toDomainMessage), [d.messages])
  const templates: MessageTemplate[]     = useMemo(() => d.templates.map(toDomainTemplate), [d.templates])
  const configs: ChannelConfig[]         = useMemo(() => d.configs.map(toDomainChannelConfig), [d.configs])

  return { messages, templates, configs, loading: cargando, error, refetch }
}

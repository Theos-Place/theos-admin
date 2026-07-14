import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  DbStudyPlan, DbGroupListItem, DbLeaderEnriched,
} from '@/lib/supabase/queries/studies'
import {
  toDomainStudyType, toDomainStudyGroup, toDomainStudyLeader,
} from '@/lib/studies/adapter'
import type { StudyType, StudyGroup, StudyLeader } from '@/types/study'

export type StudiesSlice = 'plans' | 'groups' | 'leaders'

const ENDPOINT: Record<StudiesSlice, string> = {
  plans: '/api/studies/plans',
  groups: '/api/studies/groups',
  leaders: '/api/studies/leaders',
}

// Caché a nivel de módulo: /api/studies/groups devuelve ~2,000 grupos —
// antes CADA pantalla que montaba el hook los re-descargaba aunque solo
// necesitara el catálogo de planes. refetch() la salta.
const TTL_MS = 30_000
const cache = new Map<StudiesSlice, { data: unknown[]; ts: number }>()

/** Datos de estudios por slice: `useStudies('plans')` descarga solo el
 *  catálogo de planes. Sin argumentos trae todo (compatibilidad). `leaders`
 *  arrastra `groups` (los stats del dirigente se derivan de sus grupos). */
export function useStudies(...slices: StudiesSlice[]) {
  const wanted = slices.length ? [...slices] : (['plans', 'groups', 'leaders'] as StudiesSlice[])
  if (wanted.includes('leaders') && !wanted.includes('groups')) wanted.push('groups')
  const wantedKey = wanted.join(',')

  const [dbPlans, setDbPlans]     = useState<DbStudyPlan[]>([])
  const [dbGroups, setDbGroups]   = useState<DbGroupListItem[]>([])
  const [dbLeaders, setDbLeaders] = useState<DbLeaderEnriched[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchAll = useCallback(async (force = false) => {
    const want = wantedKey.split(',') as StudiesSlice[]
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(want.map(async (slice): Promise<[StudiesSlice, unknown[]]> => {
        const hit = cache.get(slice)
        if (!force && hit && Date.now() - hit.ts < TTL_MS) return [slice, hit.data]
        const res = await fetch(ENDPOINT[slice])
        if (!res.ok) throw new Error('Error cargando estudios')
        const rows = (await res.json()) as unknown[]
        cache.set(slice, { data: rows, ts: Date.now() })
        return [slice, rows]
      }))
      for (const [slice, rows] of results) {
        if (slice === 'plans') setDbPlans(rows as DbStudyPlan[])
        else if (slice === 'groups') setDbGroups(rows as DbGroupListItem[])
        else setDbLeaders(rows as DbLeaderEnriched[])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [wantedKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  const refetch = useCallback(() => fetchAll(true), [fetchAll])

  const studyTypes: StudyType[] = useMemo(() => dbPlans.map(toDomainStudyType), [dbPlans])
  const groups: StudyGroup[]    = useMemo(() => dbGroups.map(toDomainStudyGroup), [dbGroups])
  // Los stats del líder dependen de los grupos. Precalculamos un Map por
  // dirigente para no filtrar los ~1680 grupos por cada líder (O(n²) → O(n)).
  const leaders: StudyLeader[]  = useMemo(() => {
    const byLeader = new Map<string, StudyGroup[]>()
    for (const g of groups) {
      if (!g.leader_id) continue
      const arr = byLeader.get(g.leader_id)
      if (arr) arr.push(g); else byLeader.set(g.leader_id, [g])
    }
    return dbLeaders.map((l) => toDomainStudyLeader(l, byLeader.get(l.member_id) ?? []))
  }, [dbLeaders, groups])

  return { studyTypes, groups, leaders, loading, error, refetch: refetch }
}

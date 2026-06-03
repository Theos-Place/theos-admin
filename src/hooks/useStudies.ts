import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  DbStudyPlan, DbGroupEnriched, DbLeaderEnriched, DbWaitlistEntry, DbRelocation,
} from '@/lib/supabase/queries/studies'
import {
  toDomainStudyType, toDomainStudyGroup, toDomainStudyLeader,
  toDomainWaitlistEntry, toDomainRelocation,
} from '@/lib/studies/adapter'
import type {
  StudyType, StudyGroup, StudyLeader, WaitListEntry, RelocationRequest,
} from '@/types/study'

export function useStudies() {
  const [dbPlans, setDbPlans]     = useState<DbStudyPlan[]>([])
  const [dbGroups, setDbGroups]   = useState<DbGroupEnriched[]>([])
  const [dbLeaders, setDbLeaders] = useState<DbLeaderEnriched[]>([])
  const [dbWait, setDbWait]       = useState<DbWaitlistEntry[]>([])
  const [dbReloc, setDbReloc]     = useState<DbRelocation[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [plans, groups, leaders, wait, reloc] = await Promise.all([
        fetch('/api/studies/plans'),
        fetch('/api/studies/groups'),
        fetch('/api/studies/leaders'),
        fetch('/api/studies/waitlist'),
        fetch('/api/studies/relocations'),
      ])
      if (![plans, groups, leaders, wait, reloc].every((r) => r.ok)) {
        throw new Error('Error cargando estudios')
      }
      setDbPlans(await plans.json())
      setDbGroups(await groups.json())
      setDbLeaders(await leaders.json())
      setDbWait(await wait.json())
      setDbReloc(await reloc.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const studyTypes: StudyType[] = useMemo(() => dbPlans.map(toDomainStudyType), [dbPlans])
  const groups: StudyGroup[]    = useMemo(() => dbGroups.map(toDomainStudyGroup), [dbGroups])
  // Los stats del líder dependen de los grupos ya convertidos.
  const leaders: StudyLeader[]  = useMemo(
    () => dbLeaders.map((l) => toDomainStudyLeader(l, groups)),
    [dbLeaders, groups],
  )
  const waitlist: WaitListEntry[]     = useMemo(() => dbWait.map(toDomainWaitlistEntry), [dbWait])
  const relocations: RelocationRequest[] = useMemo(() => dbReloc.map(toDomainRelocation), [dbReloc])

  return { studyTypes, groups, leaders, waitlist, relocations, loading, error, refetch: fetchAll }
}

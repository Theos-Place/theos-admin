import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbStudyPlan, DbGroupEnriched } from '@/lib/supabase/queries/studies'
import { toDomainStudyType, toDomainStudyGroup } from '@/lib/studies/adapter'
import type { StudyType, StudyGroup } from '@/types/study'

export function useStudies() {
  const [dbPlans, setDbPlans]   = useState<DbStudyPlan[]>([])
  const [dbGroups, setDbGroups] = useState<DbGroupEnriched[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [plansRes, groupsRes] = await Promise.all([
        fetch('/api/studies/plans'),
        fetch('/api/studies/groups'),
      ])
      if (!plansRes.ok || !groupsRes.ok) throw new Error('Error cargando estudios')
      setDbPlans(await plansRes.json())
      setDbGroups(await groupsRes.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const studyTypes: StudyType[]  = useMemo(() => dbPlans.map(toDomainStudyType), [dbPlans])
  const groups: StudyGroup[]     = useMemo(() => dbGroups.map(toDomainStudyGroup), [dbGroups])

  return { studyTypes, groups, loading, error, refetch: fetchAll }
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  DbCommittee, DbVacancy, DbApplication, DbCommitteeGoal,
} from '@/lib/supabase/queries/servers'
import {
  toDomainCommittee, toDomainVacancy, toDomainApplication, toDomainCommitteeGoal,
} from '@/lib/servers/adapter'
import type { CommitteeData, Vacancy, Application, CommitteeGoal } from '@/types/server'

export function useServers() {
  const [dbCommittees, setDbCommittees] = useState<DbCommittee[]>([])
  const [dbVacancies, setDbVacancies]   = useState<DbVacancy[]>([])
  const [dbApps, setDbApps]             = useState<DbApplication[]>([])
  const [dbGoals, setDbGoals]           = useState<DbCommitteeGoal[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, v, a, g] = await Promise.all([
        fetch('/api/servers/committees'),
        fetch('/api/servers/vacancies'),
        fetch('/api/servers/applications'),
        fetch('/api/servers/goals'),
      ])
      if (![c, v, a, g].every((r) => r.ok)) throw new Error('Error cargando servidores')
      setDbCommittees(await c.json())
      setDbVacancies(await v.json())
      setDbApps(await a.json())
      setDbGoals(await g.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const vacancies: Vacancy[]    = useMemo(() => dbVacancies.map(toDomainVacancy), [dbVacancies])
  const applications: Application[] = useMemo(() => dbApps.map(toDomainApplication), [dbApps])

  // open_vacancies por comité = vacantes publicadas de ese comité.
  const openByCommittee = useMemo(() => {
    const m: Record<string, number> = {}
    for (const v of dbVacancies) {
      if (v.status === 'published') m[v.committee_id] = (m[v.committee_id] ?? 0) + 1
    }
    return m
  }, [dbVacancies])

  const committees: CommitteeData[] = useMemo(
    () => dbCommittees.map((c) => toDomainCommittee(c, openByCommittee[c.id] ?? 0)),
    [dbCommittees, openByCommittee],
  )

  // Metas agrupadas por committee_id (igual que MOCK_COMMITTEE_GOALS).
  const goalsByCommittee: Record<string, CommitteeGoal[]> = useMemo(() => {
    const m: Record<string, CommitteeGoal[]> = {}
    for (const g of dbGoals) {
      (m[g.committee_id] ??= []).push(toDomainCommitteeGoal(g))
    }
    return m
  }, [dbGoals])

  return { committees, vacancies, applications, goalsByCommittee, loading, error, refetch: fetchAll }
}

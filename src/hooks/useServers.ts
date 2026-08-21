import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  DbCommittee, DbVacancy, DbApplication, DbCommitteeGoal,
} from '@/lib/supabase/queries/servers'
import {
  toDomainCommittee, toDomainVacancy, toDomainApplication, toDomainCommitteeGoal,
} from '@/lib/servers/adapter'
import type { CommitteeData, Vacancy, Application, CommitteeGoal } from '@/types/server'

export type ServersSlice = 'committees' | 'vacancies' | 'applications' | 'goals'

const ENDPOINT: Record<ServersSlice, string> = {
  committees: '/api/servers/committees',
  vacancies: '/api/servers/vacancies',
  applications: '/api/servers/applications',
  goals: '/api/servers/goals',
}

// Caché a nivel de módulo (mismo patrón que useFinance/useStudies): navegar
// entre pantallas de servidores no re-descarga los 4 endpoints. refetch() la salta.
const TTL_MS = 30_000
const cache = new Map<ServersSlice, { data: unknown[]; ts: number }>()

/** Datos de servidores por slice. Sin argumentos trae todo (compatibilidad).
 *  `committees` arrastra `vacancies` (open_vacancies se deriva de ellas). */
export function useServers(...slices: ServersSlice[]) {
  const wanted = slices.length ? [...slices] : (['committees', 'vacancies', 'applications', 'goals'] as ServersSlice[])
  if (wanted.includes('committees') && !wanted.includes('vacancies')) wanted.push('vacancies')
  const wantedKey = wanted.join(',')

  const [dbCommittees, setDbCommittees] = useState<DbCommittee[]>([])
  const [dbVacancies, setDbVacancies]   = useState<DbVacancy[]>([])
  const [dbApps, setDbApps]             = useState<DbApplication[]>([])
  const [dbGoals, setDbGoals]           = useState<DbCommitteeGoal[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const fetchAll = useCallback(async (force = false) => {
    const want = wantedKey.split(',') as ServersSlice[]
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(want.map(async (slice): Promise<[ServersSlice, unknown[]]> => {
        const hit = cache.get(slice)
        if (!force && hit && Date.now() - hit.ts < TTL_MS) return [slice, hit.data]
        const res = await fetch(ENDPOINT[slice])
        // 403 en UNA porción (p. ej. la bandeja de solicitudes, restringida a
        // coordinador de servidores/admin) deja esa porción vacía sin tumbar el
        // resto de la página.
        if (res.status === 403) return [slice, []]
        if (!res.ok) throw new Error('Error cargando servidores')
        const rows = (await res.json()) as unknown[]
        cache.set(slice, { data: rows, ts: Date.now() })
        return [slice, rows]
      }))
      for (const [slice, rows] of results) {
        if (slice === 'committees') setDbCommittees(rows as DbCommittee[])
        else if (slice === 'vacancies') setDbVacancies(rows as DbVacancy[])
        else if (slice === 'applications') setDbApps(rows as DbApplication[])
        else setDbGoals(rows as DbCommitteeGoal[])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [wantedKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  const refetch = useCallback(() => fetchAll(true), [fetchAll])

  const vacancies: Vacancy[]    = useMemo(() => dbVacancies.map(toDomainVacancy), [dbVacancies])
  const applications: Application[] = useMemo(() => dbApps.map(toDomainApplication), [dbApps])

  // open_vacancies por comité = vacantes publicadas de ese comité.
  const openByCommittee = useMemo(() => {
    const m: Record<string, number> = {}
    for (const v of dbVacancies) {
      if (v.status === 'aprobado') m[v.committee_id] = (m[v.committee_id] ?? 0) + 1
    }
    return m
  }, [dbVacancies])

  const committees: CommitteeData[] = useMemo(
    () => dbCommittees.map((c) => toDomainCommittee(c, openByCommittee[c.id] ?? 0)),
    [dbCommittees, openByCommittee],
  )

  // Metas agrupadas por committee_id.
  const goalsByCommittee: Record<string, CommitteeGoal[]> = useMemo(() => {
    const m: Record<string, CommitteeGoal[]> = {}
    for (const g of dbGoals) {
      (m[g.committee_id] ??= []).push(toDomainCommitteeGoal(g))
    }
    return m
  }, [dbGoals])

  return { committees, vacancies, applications, goalsByCommittee, loading, error, refetch }
}

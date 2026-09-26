import { useCallback, useMemo, useRef } from 'react'
import { useCargaRemota } from './useCargaRemota'
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
/** Lo que trae una carga. La constante vacía evita que un `?? {...}` cambie de
 *  identidad en cada render y deje en bucle a quien lo consuma. */
type Datos = {
  committees: DbCommittee[]; vacancies: DbVacancy[]
  applications: DbApplication[]; goals: DbCommitteeGoal[]
}
const NINGUNO: Datos = { committees: [], vacancies: [], applications: [], goals: [] }

export function useServers(...slices: ServersSlice[]) {
  const wanted = slices.length ? [...slices] : (['committees', 'vacancies', 'applications', 'goals'] as ServersSlice[])
  if (wanted.includes('committees') && !wanted.includes('vacancies')) wanted.push('vacancies')
  const wantedKey = wanted.join(',')

  /**
   * LINT-1 · Sin `setLoading` dentro del efecto: useCargaRemota lo deriva del
   * sello de la petición. `forzar` va por ref y no en la clave porque no cambia
   * QUÉ se pide, solo si se ignora el caché.
   */
  const forzarRef = useRef(false)
  const { datos, cargando, error, recargar } = useCargaRemota<Datos>(wantedKey, async () => {
    const forzar = forzarRef.current
    forzarRef.current = false
    const want = wantedKey.split(',') as ServersSlice[]
    const results = await Promise.all(want.map(async (slice): Promise<[ServersSlice, unknown[]]> => {
      const hit = cache.get(slice)
      if (!forzar && hit && Date.now() - hit.ts < TTL_MS) return [slice, hit.data]
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
    const out: Datos = { committees: [], vacancies: [], applications: [], goals: [] }
    for (const [slice, rows] of results) {
      if (slice === 'committees') out.committees = rows as DbCommittee[]
      else if (slice === 'vacancies') out.vacancies = rows as DbVacancy[]
      else if (slice === 'applications') out.applications = rows as DbApplication[]
      else out.goals = rows as DbCommitteeGoal[]
    }
    return out
  })

  // Devuelve la promesa: hay pantallas que hacen `await refetch()` y recién
  // después navegan.
  const refetch = useCallback(() => { forzarRef.current = true; return recargar() }, [recargar])

  const d = datos ?? NINGUNO
  const dbCommittees = d.committees, dbVacancies = d.vacancies
  const dbApps = d.applications, dbGoals = d.goals

  const vacancies: Vacancy[]    = useMemo(() => dbVacancies.map(toDomainVacancy), [dbVacancies])
  const applications: Application[] = useMemo(() => dbApps.map(toDomainApplication), [dbApps])

  // open_vacancies por comité = vacantes publicadas de ese comité.
  const openByCommittee = useMemo(() => {
    const m: Record<string, number> = {}
    for (const v of dbVacancies) {
      if (v.status === 'publicada') m[v.committee_id] = (m[v.committee_id] ?? 0) + 1
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

  return { committees, vacancies, applications, goalsByCommittee, loading: cargando, error, refetch }
}

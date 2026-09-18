import { useCallback, useMemo, useRef } from 'react'
import { useCargaRemota } from './useCargaRemota'
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
/** Lo que trae una carga. La constante vacía evita que un `?? {...}` cambie de
 *  identidad en cada render y deje en bucle a quien lo consuma. */
type Datos = { plans: DbStudyPlan[]; groups: DbGroupListItem[]; leaders: DbLeaderEnriched[] }
const NINGUNO: Datos = { plans: [], groups: [], leaders: [] }

export function useStudies(...slices: StudiesSlice[]) {
  const wanted = slices.length ? [...slices] : (['plans', 'groups', 'leaders'] as StudiesSlice[])
  if (wanted.includes('leaders') && !wanted.includes('groups')) wanted.push('groups')
  const wantedKey = wanted.join(',')


  /**
   * LINT-1 · Sin `setLoading` dentro del efecto: useCargaRemota deriva
   * "cargando" del sello de la petición. `forzar` va por ref y no en la clave
   * porque no cambia QUÉ se pide, solo si se ignora el caché — si fuera parte
   * de la clave, volvería a cargar sola al apagarse.
   */
  const forzarRef = useRef(false)
  const { datos, cargando, error, recargar } = useCargaRemota<Datos>(wantedKey, async () => {
    const forzar = forzarRef.current
    forzarRef.current = false
    const want = wantedKey.split(',') as StudiesSlice[]
    const results = await Promise.all(want.map(async (slice): Promise<[StudiesSlice, unknown[]]> => {
      const hit = cache.get(slice)
      if (!forzar && hit && Date.now() - hit.ts < TTL_MS) return [slice, hit.data]
      const res = await fetch(ENDPOINT[slice])
      if (!res.ok) throw new Error('Error cargando estudios')
      const rows = (await res.json()) as unknown[]
      cache.set(slice, { data: rows, ts: Date.now() })
      return [slice, rows]
    }))
    const out: Datos = { plans: [], groups: [], leaders: [] }
    for (const [slice, rows] of results) {
      if (slice === 'plans') out.plans = rows as DbStudyPlan[]
      else if (slice === 'groups') out.groups = rows as DbGroupListItem[]
      else out.leaders = rows as DbLeaderEnriched[]
    }
    return out
  })

  // Devuelve la promesa: hay pantallas que hacen `await refetch()` y recién
  // después navegan.
  const refetch = useCallback(() => { forzarRef.current = true; return recargar() }, [recargar])
  const d = datos ?? NINGUNO
  const dbPlans = d.plans, dbGroups = d.groups, dbLeaders = d.leaders

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

  return { studyTypes, groups, leaders, loading: cargando, error, refetch }
}

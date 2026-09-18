import { useMemo, useRef } from 'react'
import type { DbStudyPlan } from '@/lib/supabase/queries/studies'
import { toDomainStudyType } from '@/lib/studies/adapter'
import type { StudyType } from '@/types/study'
import { useCargaRemota, json } from './useCargaRemota'

// El plan de estudios cambia rarísimo. Cacheamos la respuesta a nivel de módulo
// para que navegar a la página (y volver) sea instantáneo dentro de la sesión;
// se invalida al crear/editar/borrar un tipo de estudio (invalidateStudyPlans).
let plansCache: DbStudyPlan[] | null = null

export function invalidateStudyPlans() {
  plansCache = null
}

const NINGUNO: DbStudyPlan[] = []

/** Solo el catálogo de planes (34 filas) — a diferencia de useStudies, NO carga
 *  los ~1,682 grupos ni los dirigentes. Para la página de Plan de Estudios. */
export function useStudyPlans() {
  // LINT-1: sin setLoading dentro del efecto. `forzar` va por ref y no en la
  // clave: no cambia QUÉ se pide, solo si se ignora el caché.
  const forzarRef = useRef(false)
  const { datos, cargando, error, recargar } = useCargaRemota<DbStudyPlan[]>('plans', async () => {
    const forzar = forzarRef.current
    forzarRef.current = false
    if (!forzar && plansCache) return plansCache
    const d = await json<DbStudyPlan[]>('/api/studies/plans', 'Error cargando el plan de estudios')
    plansCache = Array.isArray(d) ? d : []
    return plansCache
  })

  const dbPlans = datos ?? NINGUNO
  const studyTypes: StudyType[] = useMemo(() => dbPlans.map(toDomainStudyType), [dbPlans])

  return {
    studyTypes,
    loading: cargando,
    error,
    // Devuelve la promesa para quien haga `await refetch()`.
    refetch: () => { forzarRef.current = true; return recargar() },
  }
}

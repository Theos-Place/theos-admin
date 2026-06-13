import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbStudyPlan } from '@/lib/supabase/queries/studies'
import { toDomainStudyType } from '@/lib/studies/adapter'
import type { StudyType } from '@/types/study'

// El plan de estudios cambia rarísimo. Cacheamos la respuesta a nivel de módulo
// para que navegar a la página (y volver) sea instantáneo dentro de la sesión;
// se invalida al crear/editar/borrar un tipo de estudio (invalidateStudyPlans).
let plansCache: DbStudyPlan[] | null = null

export function invalidateStudyPlans() {
  plansCache = null
}

/** Solo el catálogo de planes (34 filas) — a diferencia de useStudies, NO carga
 *  los ~1,682 grupos ni los dirigentes. Para la página de Plan de Estudios. */
export function useStudyPlans() {
  const [dbPlans, setDbPlans] = useState<DbStudyPlan[]>(() => plansCache ?? [])
  const [loading, setLoading] = useState(!plansCache)
  const [error, setError] = useState<string | null>(null)

  const fetchPlans = useCallback((force = false) => {
    if (!force && plansCache) { setDbPlans(plansCache); setLoading(false); return }
    setLoading(true); setError(null)
    fetch('/api/studies/plans')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Error cargando el plan de estudios'))))
      .then((d: DbStudyPlan[]) => {
        const rows = Array.isArray(d) ? d : []
        plansCache = rows
        setDbPlans(rows)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Error desconocido'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const studyTypes: StudyType[] = useMemo(() => dbPlans.map(toDomainStudyType), [dbPlans])

  return { studyTypes, loading, error, refetch: () => fetchPlans(true) }
}

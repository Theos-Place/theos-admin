import { useState, useEffect, useMemo } from 'react'
import { useStudies } from '@/hooks/useStudies'
import { buildDirigentes, type Dirigente, type ActiveDirigente } from '@/lib/dirigentes'

/** Lista unificada de dirigentes (servidores activos del comité Dirigentes ∪
 *  quienes lideraron grupos), enriquecida con su historial de estudios. */
export function useDirigentes() {
  const { groups, studyTypes, leaders, loading: studiesLoading, error: studiesError, refetch } = useStudies()
  const [active, setActive] = useState<ActiveDirigente[]>([])
  const [loadingActive, setLoadingActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/studies/dirigentes')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Error cargando dirigentes'))))
      .then(d => { if (alive) setActive(Array.isArray(d) ? d : []) })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Error') })
      .finally(() => { if (alive) setLoadingActive(false) })
    return () => { alive = false }
  }, [])

  const designated: ActiveDirigente[] = useMemo(
    () => leaders.map(l => ({ member_id: l.member_id, member_name: l.member_name })),
    [leaders],
  )

  const dirigentes: Dirigente[] = useMemo(
    () => buildDirigentes(groups, studyTypes, active, designated),
    [groups, studyTypes, active, designated],
  )

  return {
    dirigentes,
    loading: studiesLoading || loadingActive,
    error: error ?? studiesError,
    refetch,
  }
}

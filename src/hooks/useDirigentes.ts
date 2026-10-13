import { useState, useEffect, useMemo, useCallback } from 'react'
import { useStudies } from '@/hooks/useStudies'
import { buildDirigentes, type Dirigente, type ActiveDirigente } from '@/lib/dirigentes'
import { estadoAdminDe } from '@/lib/leaders/estado-inicial'

/** Lista unificada de dirigentes (servidores activos del comité Dirigentes ∪
 *  quienes lideraron grupos), enriquecida con su historial de estudios. */
export function useDirigentes() {
  const { groups, studyTypes, leaders, loading: studiesLoading, error: studiesError, refetch: refetchStudies } = useStudies()
  const [active, setActive] = useState<ActiveDirigente[]>([])
  const [loadingActive, setLoadingActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Activos del comité (define el estado mostrado). Refetcheable: el estado de un
  // dirigente cambia al activar/desactivar, así que hay que volver a traerlo.
  const loadActive = useCallback(() => {
    return fetch('/api/studies/dirigentes')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Error cargando dirigentes'))))
      .then(d => setActive(Array.isArray(d) ? d : []))
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoadingActive(false))
  }, [])

  useEffect(() => { loadActive() }, [loadActive])

  // refetch combinado: estudios (grupos/leaders) + activos del comité.
  const refetch = useCallback(() => { refetchStudies(); loadActive() }, [refetchStudies, loadActive])

  const designated: ActiveDirigente[] = useMemo(
    () => leaders.map(l => ({ member_id: l.member_id, member_name: l.member_name })),
    [leaders],
  )

  // Config por dirigente (formación + disponibilidad) desde study_leaders.
  const config = useMemo(
    () => new Map(leaders.map(l => [l.member_id, {
      formacion: l.formation_studies ?? [],
      disponibilidad: l.qualified_studies ?? [],
      availability_status: l.availability_status,
      // DIR-8 · El estado administrativo, tal como vino del API. Las notas y
      // la banderita pueden NO ESTAR: el servidor las quita a quien no puede
      // verlas, y acá no se rellenan con vacíos para no borrar esa distinción.
      estado_admin: estadoAdminDe(l),
    }])),
    [leaders],
  )

  const dirigentes: Dirigente[] = useMemo(
    () => buildDirigentes(groups, studyTypes, active, designated, config),
    [groups, studyTypes, active, designated, config],
  )

  return {
    dirigentes,
    loading: studiesLoading || loadingActive,
    error: error ?? studiesError,
    refetch,
  }
}

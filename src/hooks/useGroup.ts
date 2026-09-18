import type { DbGroupEnriched, DbStudyPlan } from '@/lib/supabase/queries/studies'
import { toDomainStudyGroup, toDomainStudyType } from '@/lib/studies/adapter'
import type { StudyGroup, StudyType } from '@/types/study'
import { useCargaRemota } from './useCargaRemota'

type Datos = { group: StudyGroup | null; studyTypes: StudyType[] }
const NINGUNO: Datos = { group: null, studyTypes: [] }

/** Trae UN grupo completo (con participantes y nombres) por id, sin cargar la
 *  lista entera de grupos. Para páginas de detalle/cierre/asistencia. */
export function useGroup(id?: string) {
  // LINT-1: sin setLoading dentro del efecto. Sin id no hay nada que traer y
  // tampoco nada que esperar, así que `loading` es false y no hace falta
  // apagarlo a mano (que era el otro setState del efecto viejo).
  const { datos, cargando, recargar } = useCargaRemota<Datos>(id ?? '', async () => {
    if (!id) return NINGUNO
    const [g, p] = await Promise.all([
      fetch(`/api/studies/groups/${id}`),
      fetch('/api/studies/plans'),
    ])
    const gd = g.ok ? ((await g.json()) as DbGroupEnriched) : null
    const pd = p.ok ? ((await p.json()) as DbStudyPlan[]) : []
    return { group: gd ? toDomainStudyGroup(gd) : null, studyTypes: pd.map(toDomainStudyType) }
  })

  const d = datos ?? NINGUNO
  return { group: d.group, studyTypes: d.studyTypes, loading: !!id && cargando, refetch: recargar }
}

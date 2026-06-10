import { useState, useEffect, useCallback } from 'react'
import type { DbGroupEnriched, DbStudyPlan } from '@/lib/supabase/queries/studies'
import { toDomainStudyGroup, toDomainStudyType } from '@/lib/studies/adapter'
import type { StudyGroup, StudyType } from '@/types/study'

/** Trae UN grupo completo (con participantes y nombres) por id, sin cargar la
 *  lista entera de grupos. Para páginas de detalle/cierre/asistencia. */
export function useGroup(id?: string) {
  const [group, setGroup] = useState<StudyGroup | null>(null)
  const [studyTypes, setStudyTypes] = useState<StudyType[]>([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const refetch = useCallback(() => setReload(n => n + 1), [])

  useEffect(() => {
    if (!id) { setLoading(false); return }
    let alive = true
    setLoading(true)
    Promise.all([
      fetch(`/api/studies/groups/${id}`),
      fetch('/api/studies/plans'),
    ])
      .then(async ([g, p]) => {
        const gd = g.ok ? (await g.json()) as DbGroupEnriched : null
        const pd = p.ok ? (await p.json()) as DbStudyPlan[] : []
        if (!alive) return
        setGroup(gd ? toDomainStudyGroup(gd) : null)
        setStudyTypes(pd.map(toDomainStudyType))
      })
      .catch(() => { if (alive) setGroup(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, reload])

  return { group, studyTypes, loading, refetch }
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DashboardStats, DbActivity } from '@/lib/supabase/queries/dashboard'

/** Item del feed de actividad reciente del dashboard (vista). */
export type ActivityItem = {
  id: string
  actor: string
  actor_initials: string
  action: string
  resource: string
  resource_url: string
  time: string
  time_minutes: number
}

const ENTITY_LABEL: Record<string, { label: string; url: string }> = {
  members: { label: 'un miembro', url: '/miembros' },
  member_roles: { label: 'un rol', url: '/miembros' },
  events: { label: 'un evento', url: '/eventos' },
  study_groups: { label: 'un grupo de estudio', url: '/estudios/grupos' },
  payments: { label: 'un pago', url: '/finanzas/pagos' },
}

const ACTION_VERB: Record<DbActivity['action'], string> = {
  INSERT: 'creó', UPDATE: 'actualizó', DELETE: 'eliminó',
}

function toActivityItem(db: DbActivity, now: number): ActivityItem {
  const ent = ENTITY_LABEL[db.entity_type] ?? { label: db.entity_type, url: '/dashboard' }
  const mins = Math.max(0, Math.round((now - new Date(db.created_at).getTime()) / 60000))
  const time = mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`
  return {
    id: db.id,
    actor: 'Sistema',
    actor_initials: 'SY',
    action: `${ACTION_VERB[db.action]} ${ent.label}`,
    resource: db.entity_type,
    resource_url: ent.url,
    time,
    time_minutes: mins,
  }
}

/** SEC-1: `enabled:false` (dashboard de miembro) no dispara los fetches —
 *  los endpoints igual devuelven 403, esto evita el round-trip inútil. El
 *  payload de /api/dashboard viene RECORTADO por permiso (bloques parciales). */
export function useDashboard(opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true
  const [stats, setStats]       = useState<Partial<DashboardStats> | null>(null)
  const [dbActivity, setActivity] = useState<DbActivity[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, a] = await Promise.all([fetch('/api/dashboard'), fetch('/api/dashboard/activity')])
      if (![s, a].every((r) => r.ok)) throw new Error('Error cargando dashboard')
      setStats(await s.json())
      setActivity(await a.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (enabled) fetchAll() }, [enabled, fetchAll])

  const activity: ActivityItem[] = useMemo(() => {
    const now = Date.now()
    return dbActivity.map((a) => toActivityItem(a, now))
  }, [dbActivity])

  return { stats, activity, loading, error, refetch: fetchAll }
}

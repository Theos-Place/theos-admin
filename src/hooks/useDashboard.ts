import { useMemo } from 'react'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import type { DashboardStats, DbActivity } from '@/lib/supabase/queries/dashboard'
import { useMinutoActual } from '@/hooks/useReloj'

/** Vacío con identidad estable: `datos ?? []` sería un array nuevo por render. */
const SIN_ACTIVIDAD: DbActivity[] = []
type Dashboard = { stats: Partial<DashboardStats>; activity: DbActivity[] }

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
  // LINT-1 · «cargando» se deriva (useCargaRemota), no se enciende a mano.
  const { datos, cargando: loading, error, recargar: fetchAll } = useCargaRemota<Dashboard>(
    'dashboard',
    async () => {
      const [s, a] = await Promise.all([fetch('/api/dashboard'), fetch('/api/dashboard/activity')])
      if (![s, a].every((r) => r.ok)) throw new Error('Error cargando dashboard')
      return { stats: await s.json(), activity: await a.json() }
    },
    { activo: enabled },
  )
  const stats = datos?.stats ?? null
  const dbActivity = datos?.activity ?? SIN_ACTIVIDAD

  // El "hace X min" avanza solo. Antes `Date.now()` se leía dentro del memo, que
  // solo se recalcula cuando llegan datos nuevos: un dashboard abierto toda la
  // mañana seguía diciendo "hace 2 min" de algo de hace tres horas.
  const ahora = useMinutoActual()
  const activity: ActivityItem[] = useMemo(
    () => dbActivity.map((a) => toActivityItem(a, ahora)),
    [dbActivity, ahora],
  )

  return { stats, activity, loading, error, refetch: fetchAll }
}

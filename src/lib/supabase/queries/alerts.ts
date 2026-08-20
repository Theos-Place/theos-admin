import { createAdminClient, type TableName } from '@/lib/supabase/admin'
import { STUDY_ADMIN_ROLES, SERVICE_ADMIN_ROLES, type RoleId } from '@/lib/auth/roles'

export type AlertType = 'alert' | 'info' | 'warning'
export type Alert = {
  id: string
  type: AlertType
  message: (n: number) => string
  url: string
}

// Alertas derivadas de datos reales. Cada una cuenta filas pendientes en su tabla
// y solo se muestra si hay al menos una.
type AlertDef = {
  id: string
  type: AlertType
  table: TableName
  filter?: { column: string; value: string }
  /** Filtro adicional no expresable como columna=valor (ej. IS NULL). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refine?: (q: any) => any
  url: string
  message: (n: number) => string
  /** Quién ve esta alerta (admin siempre). Antes las veía CUALQUIER sesión —
   *  un dirigente recibía "solicitudes de estudios abiertas" que no le tocan. */
  roles: readonly RoleId[]
}

const ALERT_DEFS: AlertDef[] = [
  {
    // "Sin dirigente" es flag derivado (leader_id IS NULL), no un estado.
    id: 'groups-no-leader', type: 'warning', table: 'study_groups',
    refine: q => q.is('leader_id', null).neq('status', 'finalizado'),
    url: '/estudios/grupos?sin_dirigente=1',
    message: n => `${n} grupo${n !== 1 ? 's' : ''} de estudio sin dirigente asignado`,
    roles: [...STUDY_ADMIN_ROLES, 'editor_grupos_estudio'],
  },
  // Solicitudes de estudios, separadas por tipo para que la campana abra el
  // TAB correcto de /estudios/solicitudes (antes era una sola sin tab).
  {
    id: 'study-requests-relocation', type: 'info', table: 'study_requests',
    refine: q => q.eq('status', 'open').eq('request_type', 'relocation'),
    url: '/estudios/solicitudes?tab=relocation',
    message: n => `${n} cambio${n !== 1 ? 's' : ''} de grupo por atender`,
    roles: STUDY_ADMIN_ROLES,
  },
  {
    id: 'study-requests-interest', type: 'info', table: 'study_requests',
    refine: q => q.eq('status', 'open').eq('request_type', 'study_interest'),
    url: '/estudios/solicitudes?tab=study_interest',
    message: n => `${n} interés${n !== 1 ? 'es' : ''} de estudio abierto${n !== 1 ? 's' : ''}`,
    roles: STUDY_ADMIN_ROLES,
  },
  {
    id: 'applications', type: 'info', table: 'applications',
    filter: { column: 'status', value: 'pending' }, url: '/servidores/aplicaciones',
    message: n => `${n} aplicación${n !== 1 ? 'es' : ''} de servicio por revisar`,
    roles: SERVICE_ADMIN_ROLES,
  },
  {
    id: 'refunds', type: 'alert', table: 'refunds',
    filter: { column: 'status', value: 'pending' }, url: '/finanzas/devoluciones',
    message: n => `${n} devolución${n !== 1 ? 'es' : ''} pendiente${n !== 1 ? 's' : ''} de procesar`,
    roles: ['finanzas', 'direccion'],
  },
  {
    id: 'vacations', type: 'warning', table: 'vacation_records',
    filter: { column: 'status', value: 'pendiente' }, url: '/empleados',
    message: n => `${n} solicitud${n !== 1 ? 'es' : ''} de vacaciones por aprobar`,
    roles: ['encargado_staff', 'direccion'],
  },
  // QA 2026-07-17: la alerta de family_unlink_requests se quitó — la tabla no
  // tenía write-path en la app (0 filas siempre) y se eliminó en la mig 135.
]

export type ActiveAlert = { id: string; type: AlertType; message: string; url: string; count: number }

export async function getAlerts(viewerRoles: readonly string[]): Promise<ActiveAlert[]> {
  const supabase = createAdminClient()
  // Cada quien ve SOLO las alertas de su rol (admin ve todas).
  const visibles = viewerRoles.includes('admin')
    ? ALERT_DEFS
    : ALERT_DEFS.filter(def => def.roles.some(r => viewerRoles.includes(r)))
  const results = await Promise.all(
    visibles.map(async def => {
      try {
        // def.table es una unión de nombres de tabla; fijar un literal evita que
        // TS expanda toda la unión (instanciación excesiva) — el valor real es
        // el de def.table en runtime. q queda 'any' a propósito (acceso dinámico).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- acceso dinámico documentado arriba
        let q: any = supabase.from(def.table as 'members').select('*', { count: 'exact', head: true })
        if (def.filter) q = q.eq(def.filter.column, def.filter.value)
        if (def.refine) q = def.refine(q)
        const { count, error } = await q
        if (error) {
          console.warn(`getAlerts(${def.id}):`, error.message)
          return null
        }
        if (!count) return null
        return { id: def.id, type: def.type, message: def.message(count), url: def.url, count }
      } catch (e) {
        console.warn(`getAlerts(${def.id}):`, e)
        return null
      }
    }),
  )
  return results.filter((a): a is ActiveAlert => a !== null)
}

import { createAdminClient, type TableName } from '@/lib/supabase/admin'

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
}

const ALERT_DEFS: AlertDef[] = [
  {
    // "Sin dirigente" es flag derivado (leader_id IS NULL), no un estado.
    id: 'groups-no-leader', type: 'warning', table: 'study_groups',
    refine: q => q.is('leader_id', null).neq('status', 'finalizado'),
    url: '/estudios/grupos?sin_dirigente=1',
    message: n => `${n} grupo${n !== 1 ? 's' : ''} de estudio sin dirigente asignado`,
  },
  {
    id: 'study-requests', type: 'info', table: 'study_requests',
    filter: { column: 'status', value: 'open' }, url: '/estudios/solicitudes',
    message: n => `${n} solicitud${n !== 1 ? 'es' : ''} de estudios abierta${n !== 1 ? 's' : ''}`,
  },
  {
    id: 'applications', type: 'info', table: 'applications',
    filter: { column: 'status', value: 'pending' }, url: '/servidores/aplicaciones',
    message: n => `${n} aplicación${n !== 1 ? 'es' : ''} de servicio por revisar`,
  },
  {
    id: 'refunds', type: 'alert', table: 'refunds',
    filter: { column: 'status', value: 'pending' }, url: '/finanzas/devoluciones',
    message: n => `${n} devolución${n !== 1 ? 'es' : ''} pendiente${n !== 1 ? 's' : ''} de procesar`,
  },
  {
    id: 'vacations', type: 'warning', table: 'vacation_records',
    filter: { column: 'status', value: 'pendiente' }, url: '/empleados',
    message: n => `${n} solicitud${n !== 1 ? 'es' : ''} de vacaciones por aprobar`,
  },
  {
    id: 'family-unlink', type: 'info', table: 'family_unlink_requests',
    filter: { column: 'status', value: 'pending' }, url: '/miembros',
    message: n => `${n} solicitud${n !== 1 ? 'es' : ''} de desvinculación familiar`,
  },
]

export type ActiveAlert = { id: string; type: AlertType; message: string; url: string; count: number }

export async function getAlerts(): Promise<ActiveAlert[]> {
  const supabase = createAdminClient()
  const results = await Promise.all(
    ALERT_DEFS.map(async def => {
      try {
        // def.table es una unión de nombres de tabla; fijar un literal evita que
        // TS expanda toda la unión (instanciación excesiva) — el valor real es
        // el de def.table en runtime. q queda 'any' a propósito (acceso dinámico).
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

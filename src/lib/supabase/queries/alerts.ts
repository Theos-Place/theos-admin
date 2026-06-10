import { createAdminClient } from '@/lib/supabase/admin'

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
  table: string
  filter?: { column: string; value: string }
  url: string
  message: (n: number) => string
}

const ALERT_DEFS: AlertDef[] = [
  {
    id: 'groups-no-leader', type: 'warning', table: 'study_groups',
    filter: { column: 'status', value: 'pending_leader' }, url: '/estudios/grupos',
    message: n => `${n} grupo${n !== 1 ? 's' : ''} de estudio sin dirigente asignado`,
  },
  {
    id: 'relocations', type: 'info', table: 'relocation_requests',
    filter: { column: 'status', value: 'pending' }, url: '/estudios/reubicaciones',
    message: n => `${n} solicitud${n !== 1 ? 'es' : ''} de reubicación pendiente${n !== 1 ? 's' : ''}`,
  },
  {
    id: 'waitlist', type: 'info', table: 'study_waitlist', url: '/estudios/lista-de-espera',
    message: n => `${n} persona${n !== 1 ? 's' : ''} en lista de espera de estudios`,
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
        let q = supabase.from(def.table).select('*', { count: 'exact', head: true })
        if (def.filter) q = q.eq(def.filter.column, def.filter.value)
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

/**
 * Recordatorio "inicio_capacitacion": a los estudiantes inscritos de un grupo
 * cuyo inicio (starts_at) está cerca. Lo dispara el cron diario
 * (/api/studies/start-reminders). Best-effort: loguea y no lanza.
 *
 * Dedupe: study_groups.start_notified_at (mig 095) — una vez notificado, no se
 * reenvía. Ventana de 3 días para tolerar que un día no corra el cron.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { ymdCR } from '@/lib/format'

const DAY_LABEL: Record<string, string> = { L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo' }

/** Fecha de un `DATE` (YYYY-MM-DD) en formato largo CR. Ancla a mediodía para
 *  evitar el corrimiento de día al interpretar una fecha sin hora como UTC. */
function fmtDate(dateOnly: string | null): string {
  if (!dateOnly) return 'por confirmar'
  const d = new Date(dateOnly.length === 10 ? `${dateOnly}T12:00:00` : dateOnly)
  if (isNaN(d.getTime())) return dateOnly
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Costa_Rica' })
}
function fullName(m: { first_name?: string | null; last_name?: string | null } | null): string {
  return m ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() : ''
}

type GroupRow = {
  id: string
  name: string | null
  schedule_days: string[] | null
  schedule_time: string | null
  location: string | null
  starts_at: string | null
  plan: { name: string | null; description: string | null } | null
  leader: { first_name: string | null; last_name: string | null } | null
  co_leader: { first_name: string | null; last_name: string | null } | null
  enrollments: Array<{ status: string; member: { first_name: string | null; last_name: string | null; email: string | null } | null }>
}

/** Notifica el inicio de los grupos que arrancan en los próximos `daysAhead` días
 *  y no fueron notificados. Devuelve cuántos grupos y correos se procesaron. */
export async function notifyUpcomingStudyStarts(now: Date = new Date(), daysAhead = 3): Promise<{ groups: number; emails: number }> {
  const supabase = createAdminClient()
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + daysAhead)
  const today = ymdCR(now)
  const limit = ymdCR(horizon)

  const { data, error } = await supabase
    .from('study_groups')
    .select(`
      id, name, schedule_days, schedule_time, location, starts_at,
      plan:study_plans!study_groups_plan_id_fkey(name, description),
      leader:members!study_groups_leader_id_fkey(first_name, last_name),
      co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name),
      enrollments:study_enrollments!study_enrollments_group_id_fkey(status, member:members(first_name, last_name, email))
    `)
    .neq('status', 'finalizado')
    .is('start_notified_at', null)
    .gte('starts_at', today)
    .lte('starts_at', limit)
  if (error) { console.warn('notifyUpcomingStudyStarts:', error.message); return { groups: 0, emails: 0 } }

  const groups = (data ?? []) as unknown as GroupRow[]
  let emails = 0

  for (const g of groups) {
    const capacitacion = g.plan?.name || g.name || 'la capacitación'
    const dias = (g.schedule_days ?? []).map(d => DAY_LABEL[d] ?? d).join(', ') || 'por confirmar'
    const hora = g.schedule_time || 'por confirmar'
    const lugar = g.location || 'por confirmar'
    const fechaInicio = fmtDate(g.starts_at)
    const descripcion = g.plan?.description || ''
    const dirigentes = [g.leader, g.co_leader].map(l => fullName(l)).filter(Boolean).join(', ') || 'tu dirigente'

    const recipients = (g.enrollments ?? [])
      .filter(e => e.status !== 'withdrawn' && e.member?.email)

    for (const e of recipients) {
      const nombre = fullName(e.member)
      const ok = await sendSystemEmail({
        systemKey: 'inicio_capacitacion',
        to: { email: e.member!.email!, name: nombre },
        data: { nombre, nombre_capacitacion: capacitacion, fecha_inicio: fechaInicio, dias, hora, lugar, dirigentes, descripcion },
      })
      if (ok.ok) emails++
    }

    // Marcar el grupo como notificado aunque no tuviera destinatarios, para no
    // reintentarlo cada día. now.toISOString() es UTC: es un timestamp, no fecha.
    const { error: uErr } = await supabase
      .from('study_groups')
      .update({ start_notified_at: now.toISOString() })
      .eq('id', g.id)
    if (uErr) console.warn('notifyUpcomingStudyStarts: no se pudo marcar grupo', g.id, uErr.message)
  }

  return { groups: groups.length, emails }
}

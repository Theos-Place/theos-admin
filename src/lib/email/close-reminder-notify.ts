/**
 * DIR-3 · Recordatorio de cierre al dirigente Y al co-dirigente.
 *
 * Dos avisos y no más:
 *   1. `cierre_pendiente` — falta una semana o menos para terminar.
 *   2. `cierre_vencido`   — pasaron 7 días del fin y el grupo sigue en curso.
 *      Además, notificación interna a la coordinación de estudios: a partir de
 *      acá es gestión humana, no más correos automáticos.
 *
 * Dedupe: `study_groups.close_reminder_sent_at` y `close_overdue_notified_at`
 * (mismo patrón que start_notified_at). Se sella SIEMPRE al terminar de procesar
 * el grupo, aunque un correo falle: si no, el siguiente día le vuelve a escribir
 * a quien sí lo recibió.
 *
 * Best-effort: loguea y no lanza.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { ymdCR } from '@/lib/format'
import {
  resolveEndDate, closeReminderDue, MAX_CLOSE_REMINDERS_PER_RUN,
  type CloseReminderKind,
} from '@/lib/studies/close-reminder'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'

/** Fecha larga en CR. Ancla a mediodía para que una fecha sin hora no se corra de día. */
function fmtDate(dateOnly: string): string {
  const d = new Date(`${dateOnly}T12:00:00`)
  if (isNaN(d.getTime())) return dateOnly
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Costa_Rica' })
}

type Persona = { first_name: string | null; last_name: string | null; email: string | null } | null

type GroupRow = {
  id: string
  name: string | null
  status: string
  starts_at: string | null
  ends_at: string | null
  close_reminder_sent_at: string | null
  close_overdue_notified_at: string | null
  plan: { name: string | null; duration_weeks: number | null } | { name: string | null; duration_weeks: number | null }[] | null
  leader: Persona | Persona[]
  co_leader: Persona | Persona[]
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export type CloseReminderResult = {
  revisados: number
  proximo: number
  vencido: number
  emails: number
  sin_fecha: number
  coordinacion_notificada: number
  /** Grupos que quedaron para mañana por el tope de la corrida. */
  pospuestos: number
}

export async function notifyPendingGroupCloses(now: Date = new Date()): Promise<CloseReminderResult> {
  const supabase = createAdminClient()
  const hoy = ymdCR(now)
  const out: CloseReminderResult = {
    revisados: 0, proximo: 0, vencido: 0, emails: 0, sin_fecha: 0,
    coordinacion_notificada: 0, pospuestos: 0,
  }

  const { data, error } = await supabase
    .from('study_groups')
    .select(`
      id, name, status, starts_at, ends_at, close_reminder_sent_at, close_overdue_notified_at,
      plan:study_plans!study_groups_plan_id_fkey(name, duration_weeks),
      leader:members!study_groups_leader_id_fkey(first_name, last_name, email),
      co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name, email)
    `)
    .eq('status', 'en_curso')
  if (error) throw error

  for (const raw of (data ?? []) as unknown as GroupRow[]) {
    out.revisados++
    const plan = one(raw.plan)
    const endDate = resolveEndDate({
      ends_at: raw.ends_at, starts_at: raw.starts_at, plan_weeks: plan?.duration_weeks ?? null,
    })
    if (!endDate) { out.sin_fecha++; continue }

    const kind: CloseReminderKind = closeReminderDue({
      endDate,
      todayYmd: hoy,
      status: raw.status,
      proximoSent: !!raw.close_reminder_sent_at,
      vencidoSent: !!raw.close_overdue_notified_at,
    })
    if (!kind) continue
    // Tope por corrida: lo que no entra hoy sale mañana (no se sella nada).
    if (out.proximo + out.vencido >= MAX_CLOSE_REMINDERS_PER_RUN) { out.pospuestos++; continue }

    const nombreEstudio = plan?.name ?? raw.name ?? 'tu estudio'
    const nombreGrupo = raw.name ?? 'tu grupo'
    const link = `${SITE}/estudios/grupos/${raw.id}/cierre`

    // Al dirigente Y al co-dirigente. Dedupe por correo: si son la misma
    // persona o comparten dirección, un solo envío.
    const destinatarios = [one(raw.leader), one(raw.co_leader)]
      .filter((p): p is NonNullable<Persona> => !!p?.email)
    const vistos = new Set<string>()
    for (const p of destinatarios) {
      const correo = (p.email as string).trim().toLowerCase()
      if (!correo || vistos.has(correo)) continue
      vistos.add(correo)
      const nombre = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
      const { ok } = await sendSystemEmail({
        systemKey: kind === 'proximo' ? 'cierre_pendiente' : 'cierre_vencido',
        to: { email: p.email as string, name: nombre },
        data: {
          nombre: p.first_name ?? nombre,
          nombre_estudio: nombreEstudio,
          nombre_grupo: nombreGrupo,
          fecha_fin: fmtDate(endDate),
          link_cierre: link,
        },
      })
      if (ok) out.emails++
    }

    if (kind === 'vencido') {
      out.coordinacion_notificada += await avisarCoordinacion(supabase, {
        groupId: raw.id, nombreEstudio, nombreGrupo, fechaFin: fmtDate(endDate),
      })
    }

    // Sellar SIEMPRE, aunque algún correo haya fallado.
    const patch = kind === 'proximo'
      ? { close_reminder_sent_at: new Date().toISOString() }
      : { close_overdue_notified_at: new Date().toISOString() }
    await supabase.from('study_groups').update(patch).eq('id', raw.id)
    out[kind]++
  }

  return out
}

/** Aviso interno a coordinación cuando un grupo quedó vencido sin cerrar. */
async function avisarCoordinacion(
  supabase: ReturnType<typeof createAdminClient>,
  g: { groupId: string; nombreEstudio: string; nombreGrupo: string; fechaFin: string },
): Promise<number> {
  const { data: roleRows } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
    .in('role', ['coordinador_estudios', 'coordinador_dirigentes'])
    .eq('is_active', true)
  const dest = [...new Set(((roleRows ?? []) as unknown as Array<{
    member_id: string; member: { is_active: boolean } | { is_active: boolean }[] | null
  }>)
    .filter(r => (Array.isArray(r.member) ? r.member[0] : r.member)?.is_active === true)
    .map(r => r.member_id))]
  if (dest.length === 0) return 0

  const { error } = await supabase.from('internal_notifications').insert(dest.map(memberId => ({
    recipient_member_id: memberId,
    type: 'close_overdue',
    title: `${g.nombreEstudio} sigue sin cerrar`,
    body: `${g.nombreGrupo} terminó el ${g.fechaFin} y sigue en curso. Ya se le avisó dos veces al dirigente; de acá en adelante hay que buscarlo.`,
    link: `/estudios/grupos/${g.groupId}`,
  })))
  if (error) { console.warn('aviso de cierre vencido a coordinación:', error.message); return 0 }
  return dest.length
}

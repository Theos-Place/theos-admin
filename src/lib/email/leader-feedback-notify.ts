// Pide la retroalimentación del dirigente a los estudiantes cuando el grupo
// cierra.
//
// A QUIÉNES: a quienes LLEVARON el estudio (completed/enrolled). Quien se retiró
// temprano no vio el estudio y no tiene qué evaluar — mismo criterio que el
// guard del endpoint (CAN_EVALUATE_STATUSES).
//
// DEDUPE: study_groups.feedback_requested_at. Se sella SIEMPRE al terminar,
// aunque algún envío falle: si no, re-cerrar o reintentar le vuelve a escribir a
// los que ya recibieron.
//
// Best-effort: el cierre del grupo NO se cae porque el correo falle.
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { filterByNotifPref } from '@/lib/notifications/dispatch'
import { CAN_EVALUATE_STATUSES } from '@/lib/studies/leader-feedback'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function requestLeaderFeedback(groupId: string): Promise<{ sent: number; skipped?: string }> {
  const sb = createAdminClient() as unknown as SupabaseClient

  const { data: g } = await sb
    .from('study_groups')
    .select('id, name, status, leader_id, co_leader_id, feedback_requested_at, plan:study_plans(name), leader:members!study_groups_leader_id_fkey(first_name, last_name)')
    .eq('id', groupId)
    .maybeSingle()
  const grupo = g as unknown as {
    id: string; name: string | null; status: string | null
    leader_id: string | null; co_leader_id: string | null
    feedback_requested_at: string | null
    plan: { name: string | null } | null
    leader: { first_name: string; last_name: string } | null
  } | null

  if (!grupo) return { sent: 0, skipped: 'grupo no encontrado' }
  if (grupo.feedback_requested_at) return { sent: 0, skipped: 'ya se pidió' }
  if (grupo.status !== 'finalizado') return { sent: 0, skipped: 'el grupo no está cerrado' }
  // Sin dirigente no hay a quién evaluar.
  if (!grupo.leader_id) return { sent: 0, skipped: 'grupo sin dirigente' }

  const { data: enr } = await sb
    .from('study_enrollments')
    .select('member_id, status')
    .eq('group_id', groupId)
    .in('status', CAN_EVALUATE_STATUSES as unknown as string[])
  const alumnos = [...new Set(((enr ?? []) as Array<{ member_id: string }>).map(e => e.member_id))]
    // El dirigente y el co-dirigente no se evalúan a sí mismos.
    .filter(id => id !== grupo.leader_id && id !== grupo.co_leader_id)

  if (alumnos.length === 0) {
    await sellar(sb, groupId)
    return { sent: 0, skipped: 'sin estudiantes que evaluar' }
  }

  const permitidos = await filterByNotifPref(sb, alumnos, 'mensajes_sistema')
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
  const link = `${site}/estudios/grupos/${groupId}/evaluar`
  const nombreEstudio = grupo.plan?.name ?? grupo.name ?? 'el estudio'
  const nombreDirigente = grupo.leader
    ? `${grupo.leader.first_name} ${grupo.leader.last_name}`.trim()
    : 'tu dirigente'

  let sent = 0
  const vistos = new Set<string>()
  for (let i = 0; i < permitidos.length; i += 300) {
    const slice = permitidos.slice(i, i + 300)
    const { data: mems } = await sb
      .from('members').select('first_name, last_name, email')
      .in('id', slice).not('email', 'is', null)
    for (const m of (mems ?? []) as Array<{ first_name: string; last_name: string; email: string }>) {
      const correo = m.email.trim().toLowerCase()
      if (!correo || vistos.has(correo)) continue
      vistos.add(correo)
      const nombre = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
      const { ok } = await sendSystemEmail({
        systemKey: 'retro_dirigente',
        to: { email: m.email, name: nombre },
        data: { nombre, nombre_estudio: nombreEstudio, nombre_dirigente: nombreDirigente, link_encuesta: link },
      })
      if (ok) sent++
    }
  }

  await sellar(sb, groupId)
  return { sent }
}

async function sellar(sb: SupabaseClient, groupId: string) {
  await sb.from('study_groups')
    .update({ feedback_requested_at: new Date().toISOString() })
    .eq('id', groupId)
}

// FEA-1: correo "form_asignado" a los destinatarios de la entidad a la que se
// asigna un formulario. Destinatarios: inscritos del evento (tiquete no
// expirado) o matriculados activos ('enrolled') del grupo de estudio. Respeta
// la preferencia silenciable 'mensajes_sistema' y el dedupe por asignación
// (forms.assignment_notified_key). Best-effort: los callers no revientan el
// guardado del form si el correo falla.
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { filterByNotifPref } from '@/lib/notifications/dispatch'
import { shouldNotifyAssignment, type AssignmentSnapshot } from '@/lib/forms/assignment-rules'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function notifyFormAssignedIfNeeded(formId: string): Promise<{ sent: number }> {
  const supabase = createAdminClient() as unknown as SupabaseClient

  const { data: form } = await supabase
    .from('forms')
    .select('id, title, is_active, entity_type, entity_id, assignment_notified_key')
    .eq('id', formId)
    .maybeSingle()
  if (!form) return { sent: 0 }

  const snap = form as unknown as AssignmentSnapshot & { id: string; title: string }
  const { notify, key } = shouldNotifyAssignment(snap)
  if (!notify || !key) return { sent: 0 }

  // Destinatarios según la entidad.
  let memberIds: string[] = []
  if (snap.entity_type === 'event') {
    const { data } = await supabase
      .from('event_registrations')
      .select('member_id')
      .eq('event_id', snap.entity_id!)
      .not('member_id', 'is', null)
      .neq('payment_status', 'expired')
    memberIds = [...new Set(((data ?? []) as Array<{ member_id: string }>).map(r => r.member_id))]
  } else if (snap.entity_type === 'study_group') {
    const { data } = await supabase
      .from('study_enrollments')
      .select('member_id')
      .eq('group_id', snap.entity_id!)
      .eq('status', 'enrolled')
    memberIds = [...new Set(((data ?? []) as Array<{ member_id: string }>).map(r => r.member_id))]
  }

  // Sin destinatarios: NO se marca la clave — si la gente se inscribe después
  // y se re-guarda el form, el aviso todavía puede salir.
  if (memberIds.length === 0) return { sent: 0 }

  const allowed = await filterByNotifPref(supabase, memberIds, 'mensajes_sistema')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
  const linkForm = `${siteUrl}/formularios/${snap.id}/preview`
  let sent = 0
  const seenEmails = new Set<string>()
  for (let i = 0; i < allowed.length; i += 300) {
    const slice = allowed.slice(i, i + 300)
    const { data: mems } = await supabase
      .from('members')
      .select('id, first_name, last_name, email')
      .in('id', slice)
      .not('email', 'is', null)
    for (const m of (mems ?? []) as Array<{ id: string; first_name: string; last_name: string; email: string }>) {
      const email = m.email.trim().toLowerCase()
      if (!email || seenEmails.has(email)) continue
      seenEmails.add(email)
      const nombre = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
      const { ok } = await sendSystemEmail({
        systemKey: 'form_asignado',
        to: { email: m.email, name: nombre },
        data: { nombre, nombre_form: snap.title, link_form: linkForm },
      })
      if (ok) sent++
    }
  }

  // Marca el dedupe aunque algún envío individual haya fallado: la asignación
  // ya fue notificada como lote (re-guardar no debe duplicar a los que sí les llegó).
  await supabase.from('forms').update({ assignment_notified_key: key }).eq('id', formId)
  return { sent }
}

// SRV-20 (etapa 4, parte A) · Correo "sirve_invitacion": el dirigente de un
// grupo de SCJ invita a sus estudiantes a llenar el perfil S.I.R.V.E.
//
// Calcado de form-assigned-notify (FEA-1): respeta la preferencia silenciable
// 'mensajes_sistema', manda uno por correo distinto, y registra a quién se le
// mandó en `sirve_form_invites` — POR PERSONA, porque el reenvío va solo a
// quienes aún no llenaron el perfil. Las reglas de quién recibe en cada clic
// viven en lib/servers/invitacion-perfil-sirve (puras, con tests).
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { filterByNotifPref } from '@/lib/notifications/dispatch'
import { formShareUrl } from '@/lib/forms/share-link'
import { TITULO_DEL_FORMULARIO } from '@/lib/servers/formulario-perfil-sirve'
import {
  destinatariosDelEnvio, resumenDeInvitaciones, ESTADOS_QUE_RECIBEN, SYSTEM_KEY, type Destinatario,
} from '@/lib/servers/invitacion-perfil-sirve'
import type { SupabaseClient } from '@supabase/supabase-js'

/** El estado de las invitaciones de un grupo: lo que el botón muestra. */
export async function estadoDeInvitaciones(groupId: string): Promise<ReturnType<typeof resumenDeInvitaciones> & { form_id: string | null }> {
  const supabase = createAdminClient() as unknown as SupabaseClient
  const [lista, form] = await Promise.all([listaDelGrupo(supabase, groupId), formIdDelPerfil(supabase)])
  return { ...resumenDeInvitaciones(lista), form_id: form }
}

export async function enviarInvitacionSirve(input: {
  groupId: string
  reenviar: boolean
  /** auth.users id de quien aprieta: queda en sent_by. */
  actorUserId: string
}): Promise<{ sent: number; omitidos: number; error?: string }> {
  const supabase = createAdminClient() as unknown as SupabaseClient
  const formId = await formIdDelPerfil(supabase)
  if (!formId) return { sent: 0, omitidos: 0, error: `No existe el formulario «${TITULO_DEL_FORMULARIO}». Hay que sembrarlo primero.` }

  const { data: grupo } = await supabase
    .from('study_groups')
    .select('name, leader:members!study_groups_leader_id_fkey(first_name, last_name)')
    .eq('id', input.groupId).maybeSingle()
  const lider = (grupo as { leader?: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null } | null)?.leader
  const l = Array.isArray(lider) ? lider[0] : lider
  const nombreDirigente = `${l?.first_name ?? ''} ${l?.last_name ?? ''}`.trim() || 'tu dirigente'
  const nombreGrupo = (grupo as { name?: string } | null)?.name ?? 'tu grupo'

  const lista = await listaDelGrupo(supabase, input.groupId)
  const aEnviar = destinatariosDelEnvio(lista, input.reenviar)
  if (aEnviar.length === 0) return { sent: 0, omitidos: 0 }

  const allowed = await filterByNotifPref(supabase, aEnviar.map(d => d.memberId), 'mensajes_sistema')
  const linkForm = formShareUrl(formId)
  let sent = 0
  const seenEmails = new Set<string>()
  const enviados: string[] = []
  for (let i = 0; i < allowed.length; i += 300) {
    const slice = allowed.slice(i, i + 300)
    const { data: mems } = await supabase
      .from('members').select('id, first_name, last_name, email').in('id', slice).not('email', 'is', null)
    for (const m of (mems ?? []) as Array<{ id: string; first_name: string; last_name: string; email: string }>) {
      const email = m.email.trim().toLowerCase()
      if (!email || seenEmails.has(email)) continue
      seenEmails.add(email)
      const nombre = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
      // BEC-3: `ok` es «no falló»; `enviado` es «salió de verdad». Con el modo
      // silencioso o un dominio .invalid, `ok` es true y el correo no salió:
      // registrarlo como invitado dejaría a esa persona fuera del reenvío.
      const { enviado } = await sendSystemEmail({
        systemKey: SYSTEM_KEY,
        to: { email: m.email, name: nombre },
        data: { nombre, nombre_grupo: nombreGrupo, nombre_dirigente: nombreDirigente, link_form: linkForm },
      })
      if (enviado) { sent++; enviados.push(m.id) }
    }
  }

  // Se registra SOLO a quien de verdad se le mandó: si un correo falló, un
  // clic de reenvío lo vuelve a intentar en vez de darlo por hecho.
  if (enviados.length) {
    const ahora = new Date().toISOString()
    const { data: previas } = await supabase.from('sirve_form_invites').select('member_id, veces').eq('group_id', input.groupId).in('member_id', enviados)
    const veces = new Map(((previas ?? []) as Array<{ member_id: string; veces: number }>).map(p => [p.member_id, p.veces]))
    await supabase.from('sirve_form_invites').upsert(
      enviados.map(member_id => ({ member_id, group_id: input.groupId, sent_at: ahora, sent_by: input.actorUserId, veces: (veces.get(member_id) ?? 0) + 1 })),
      { onConflict: 'member_id,group_id' },
    )
  }
  return { sent, omitidos: aEnviar.length - sent }
}

/** Los matriculados vigentes del grupo, con si ya se les invitó y si ya llenaron. */
async function listaDelGrupo(supabase: SupabaseClient, groupId: string): Promise<Destinatario[]> {
  const { data: mats } = await supabase
    .from('study_enrollments').select('member_id').eq('group_id', groupId).in('status', [...ESTADOS_QUE_RECIBEN])
  const ids = [...new Set(((mats ?? []) as Array<{ member_id: string }>).map(m => m.member_id))]
  if (ids.length === 0) return []
  const [{ data: inv }, { data: perf }, { data: mems }, permitidos] = await Promise.all([
    supabase.from('sirve_form_invites').select('member_id').eq('group_id', groupId).in('member_id', ids),
    supabase.from('member_spiritual_data').select('member_id').in('member_id', ids).not('editado_en_sistema_at', 'is', null),
    supabase.from('members').select('id, email').in('id', ids),
    filterByNotifPref(supabase, ids, 'mensajes_sistema'),
  ])
  const invitados = new Set(((inv ?? []) as Array<{ member_id: string }>).map(x => x.member_id))
  const llenaron = new Set(((perf ?? []) as Array<{ member_id: string }>).map(x => x.member_id))
  // Mismo criterio que sendEmail: sin correo o dominio .invalid (cuentas de
  // prueba) no sale nada, y la preferencia apagada tampoco.
  const conCorreo = new Set(((mems ?? []) as Array<{ id: string; email: string | null }>)
    .filter(m => m.email?.trim() && !/\.invalid$/i.test(m.email.trim())).map(m => m.id))
  const avisos = new Set(permitidos)
  return ids.map(memberId => ({
    memberId, yaInvitado: invitados.has(memberId), yaLleno: llenaron.has(memberId),
    contactable: conCorreo.has(memberId) && avisos.has(memberId),
  }))
}

/** El formulario espejo, por su título (es como lo siembra el seed). */
async function formIdDelPerfil(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from('forms').select('id').eq('title', TITULO_DEL_FORMULARIO).eq('is_active', true).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

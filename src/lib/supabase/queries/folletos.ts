import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLES } from '@/lib/auth/roles'
import type { FolletoState } from '@/lib/studies/folletos'
import { estimatedAvailableDate, levelLabel } from '@/lib/studies/folletos'
import { hasOwnFolleto, shouldCreateAutoFolleto, type AutoFolletoTipo } from '@/lib/studies/folleto-auto-rules'


export type DbFolletoRequest = {
  id: string
  source_group_id: string | null
  source_plan_code: string | null
  target_level_code: string | null
  quantity: number
  sede: string | null
  close_date: string
  available_at: string
  status: FolletoState
  tipo: string
  bloque_id: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  note: string | null
  target_leader_id: string | null
  target_leader_name: string | null
  source_group: { name: string | null } | null
  bloque: { nombre: string } | null
  target_leader: { first_name: string | null; last_name: string | null } | null
}

/** Ids de rol que otorgan el módulo 'folletos' (derivado de ROLES, no hardcodeado). */
function folletoRoleIds(): string[] {
  return ROLES
    .filter(r => r.permissions.some(p =>
      (p.module === 'all' || p.module === 'folletos') && (p.actions as string[]).includes('view')))
    .map(r => r.id)
}

/** Personas con el permiso de folletos activo (para notificaciones + correos). */
export async function getFolletoRecipients(): Promise<Array<{ member_id: string; email: string | null; name: string }>> {
  const supabase = createAdminClient()
  const roleIds = folletoRoleIds()
  if (roleIds.length === 0) return []
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(email, first_name, last_name, is_active)')
    .in('role', roleIds)
    .eq('is_active', true)
  if (error) { console.warn('getFolletoRecipients:', error.message); return [] }
  const byId = new Map<string, { member_id: string; email: string | null; name: string }>()
  for (const r of (data ?? []) as Array<{ member_id: string; member: { email: string | null; first_name: string; last_name: string; is_active: boolean } | null }>) {
    if (!r.member || r.member.is_active === false) continue
    byId.set(r.member_id, {
      member_id: r.member_id,
      email: r.member.email,
      name: `${r.member.first_name} ${r.member.last_name}`.trim(),
    })
  }
  return [...byId.values()]
}

/** Sede tomada del perfil del dirigente (líder) del grupo. */
export async function getLeaderSedeForGroup(groupId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: g } = await supabase.from('study_groups').select('leader_id').eq('id', groupId).maybeSingle()
  const leaderId = (g as { leader_id: string | null } | null)?.leader_id
  if (!leaderId) return null
  const { data: m } = await supabase
    .from('members').select('sede:sedes(name)').eq('id', leaderId).maybeSingle()
  const sede = (m as { sede: { name: string } | { name: string }[] | null } | null)?.sede
  const one = Array.isArray(sede) ? sede[0] : sede
  return one?.name ?? null
}

/** Sede resuelta para un grupo, en orden: 1) la sede de ENTREGA DE FOLLETOS
 *  elegida al crear el grupo (folletos_sede, si no es TBD); 2) el perfil del
 *  dirigente (líder); 3) la zona propia del grupo. Usado por todo folleto
 *  generado a partir de un grupo (automáticos y reubicación individual). */
export async function getSedeForGroup(groupId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: g } = await supabase.from('study_groups').select('zone, folletos_sede').eq('id', groupId).maybeSingle()
  const row = g as { zone: string | null; folletos_sede: string | null } | null
  if (row?.folletos_sede && row.folletos_sede !== 'TBD') return row.folletos_sede
  const leaderSede = await getLeaderSedeForGroup(groupId)
  if (leaderSede) return leaderSede
  const zoneCode = row?.zone
  if (!zoneCode) return null
  const { data: s } = await supabase.from('sedes').select('name').eq('code', zoneCode).maybeSingle()
  return (s as { name: string } | null)?.name ?? null
}

export async function createFolletoRequest(input: {
  source_group_id: string
  source_plan_code: string
  target_level_code: string
  quantity: number
  sede: string | null
  close_date: string
  available_at: string
  confirmed_by: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('folleto_requests').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** FOL-1: tiquete AUTOMÁTICO de folletos del PROPIO nivel del grupo.
 *  Dispara en dos momentos (reglas que reemplazan cierre/hitos):
 *    · cupo_lleno:    al confirmar la matrícula que llena el cupo;
 *    · fin_matricula: al vencer la ventana (GRU-1) con >= 5 matriculados.
 *  Idempotente: el índice único parcial folleto_requests_auto_por_grupo
 *  garantiza UN tiquete por grupo (el 23505 se trata como "ya existe").
 *  Best-effort para los callers: nunca revienta la matrícula ni el cron. */
export async function createAutoFolletoIfNeeded(
  groupId: string,
  tipo: AutoFolletoTipo,
  todayIso: string,
  /** Lugar de entrega dicho por quien cierra. Si no viene, se resuelve solo
   *  (grupo → dirigente → zona) como siempre. */
  sedeExplicita?: string | null,
): Promise<{ created: boolean; reason?: string }> {
  const supabase = createAdminClient()
  const [{ data: g }, { count }] = await Promise.all([
    supabase.from('study_groups')
      .select('id, max_students, folletos_sede, plan:study_plans(code)')
      .eq('id', groupId).maybeSingle(),
    // 'pendiente_de_pago' cuenta: los que avanzan por cierre entran así (la
    // matrícula es efectiva de inmediato y el cobro va aparte), y si no se
    // contaran, el grupo sucesor tendría 0 y nunca pediría folletos.
    supabase.from('study_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId).in('status', ['enrolled', 'pendiente_de_pago']),
  ])
  const row = g as { id: string; max_students: number | null; folletos_sede: string | null; plan: { code: string | null } | { code: string | null }[] | null } | null
  if (!row) return { created: false, reason: 'grupo_no_encontrado' }
  const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan
  const code = plan?.code ?? null
  if (!hasOwnFolleto(code)) return { created: false, reason: 'plan_sin_folleto' }

  const enrolled = count ?? 0
  if (!shouldCreateAutoFolleto(tipo, { enrolled, max_students: row.max_students })) {
    return { created: false, reason: 'umbral_no_alcanzado' }
  }

  // Resolución única (getSedeForGroup): sede de entrega del grupo → sede del
  // dirigente → zona del grupo.
  const sede = (sedeExplicita ?? '').trim() || await getSedeForGroup(groupId)
  const { error } = await supabase.from('folleto_requests').insert({
    tipo,
    source_group_id: groupId,
    source_plan_code: code,
    target_level_code: code,
    quantity: enrolled,
    sede,
    close_date: todayIso,
    available_at: estimatedAvailableDate(todayIso),
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') return { created: false, reason: 'ya_existe' }
    throw error
  }

  const label = levelLabel(code)
  const tipoLabel = tipo === 'cupo_lleno' ? 'cupo lleno' : 'fin de matrícula'
  await notifyFolletoRecipients({
    title: 'Folletos solicitados',
    body: `${enrolled} folleto${enrolled !== 1 ? 's' : ''} de ${label} · ${sede ?? 'sede sin definir'} (${tipoLabel})`,
    subject: `Folletos de ${label} — ${sede ?? 'sede sin definir'}`,
    html: `
      <p>Se generó una solicitud de folletos automática (${tipoLabel}).</p>
      <ul>
        <li><strong>Nivel:</strong> ${label}</li>
        <li><strong>Cantidad:</strong> ${enrolled}</li>
        <li><strong>Sede:</strong> ${sede ?? 'sin definir'}</li>
      </ul>
      <p>Podés seguir el estado en el sistema, en Estudios &rsaquo; Folletos.</p>
    `,
  })
  return { created: true }
}

/** Solicitud de folletos MANUAL (caso especial, no ligada a cierre): entra a la
 *  misma cola con tipo 'manual'. Guarda cantidad, sede, dirigente destinatario y
 *  nota. close_date/available_at = hoy (no hay cierre que las derive). */
export async function createManualFolletoRequest(input: {
  target_level_code: string
  quantity: number
  sede: string | null
  target_leader_id: string | null
  target_leader_name: string | null
  note: string | null
  today: string
  confirmed_by: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('folleto_requests').insert({
    tipo: 'manual',
    target_level_code: input.target_level_code,
    quantity: input.quantity,
    sede: input.sede,
    target_leader_id: input.target_leader_id,
    target_leader_name: input.target_leader_name,
    note: input.note,
    close_date: input.today,
    available_at: input.today,
    status: 'creada',
    confirmed_by: input.confirmed_by,
  }).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function getFolletoRequests(filters: { sede?: string; status?: FolletoState; tipo?: string } = {}): Promise<DbFolletoRequest[]> {
  const supabase = createAdminClient()
  let q = supabase
    .from('folleto_requests')
    .select('id, source_group_id, source_plan_code, target_level_code, quantity, sede, close_date, available_at, status, tipo, bloque_id, confirmed_by, confirmed_at, created_at, note, target_leader_id, target_leader_name, source_group:study_groups(name), bloque:capacitacion_bloques(nombre), target_leader:members!folleto_requests_target_leader_id_fkey(first_name, last_name)')
    .order('created_at', { ascending: false })
  if (filters.sede) q = q.eq('sede', filters.sede)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.tipo) q = q.eq('tipo', filters.tipo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    source_group: Array.isArray(row.source_group) ? (row.source_group[0] ?? null) : row.source_group,
    bloque: Array.isArray(row.bloque) ? (row.bloque[0] ?? null) : row.bloque,
    target_leader: Array.isArray(row.target_leader) ? (row.target_leader[0] ?? null) : row.target_leader,
  })) as DbFolletoRequest[]
}

/** Cambio de estado (individual o en lote). QA 2026-07-17: el flujo es LINEAL
 *  (creada → en_impresion → enviado_entregado → cerrada) y la UI solo ofrece
 *  "avanzar al siguiente" — el update se condiciona al estado PREDECESOR, así
 *  un request repetido/adulterado no salta pasos ni retrocede. Las filas que
 *  no estaban en el estado esperado se omiten (se refleja en `updated`). */
export async function setFolletoRequestsStatus(ids: string[], status: FolletoState): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 }
  const { FOLLETO_STATES } = await import('@/lib/studies/folletos')
  const idx = FOLLETO_STATES.indexOf(status)
  if (idx <= 0) return { updated: 0 } // 'creada' es inicial: no se llega por transición
  const prev = FOLLETO_STATES[idx - 1]
  const supabase = createAdminClient()
  const { error, count } = await supabase
    .from('folleto_requests')
    .update({ status, updated_at: new Date().toISOString() }, { count: 'exact' })
    .in('id', ids)
    .eq('status', prev)
  if (error) throw error
  return { updated: count ?? 0 }
}

/** Notifica (campana + correo) a quienes tienen el permiso de folletos.
 *  Centraliza el patrón que duplicaban el cierre de grupo y el cron de
 *  bloques (~40 líneas cada uno). Best-effort: los correos fallidos se
 *  loguean sin bloquear (allSettled — antes eran awaits secuenciales). */
export async function notifyFolletoRecipients(input: {
  title: string
  body: string
  subject: string
  html: string
  /** Destino de la campana. Default: la cola de folletos. Los avisos de hito
   *  de bloque apuntan a /estudios/bloques (el hito ya no crea tiquetes). */
  link?: string
}): Promise<void> {
  const recipients = await getFolletoRecipients()
  if (recipients.length === 0) return
  const supabase = createAdminClient()

  const { error } = await supabase.from('internal_notifications').insert(recipients.map(r => ({
    recipient_member_id: r.member_id,
    type: 'folleto_created',
    title: input.title,
    body: input.body,
    link: input.link ?? '/estudios/folletos',
  })))
  if (error) console.warn('notifyFolletoRecipients notificaciones:', error.message)

  const { sendEmail } = await import('@/lib/email/provider')
  await Promise.allSettled(recipients
    .filter(r => r.email)
    .map(r => sendEmail({
      to: { email: r.email!, name: r.name },
      subject: input.subject,
      html: input.html,
      kind: 'transactional',
    }).catch(e => console.warn('sendEmail folletos falló:', e))))
}

import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLES } from '@/lib/auth/roles'
import type { FolletoState } from '@/lib/studies/folletos'
import { estimatedAvailableDate, levelLabel } from '@/lib/studies/folletos'
import { hasOwnFolleto, shouldCreateAutoFolleto, type AutoFolletoTipo } from '@/lib/studies/folleto-auto-rules'
import { desgloseFolletos, type DesgloseFolletos } from '@/lib/studies/folleto-desglose'
import { contarResultadosCierre, type ConteoCierre } from '@/lib/studies/close-result-read'


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
  /** Pagos individuales enlazados a este tiquete. Ausente = nivel sin cobro. */
  pagos: { total: number; pagados: number }
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
  /** El grupo que se CERRÓ (tipo='cierre'). `groupId` es el sucesor, el que va
   *  a usar los folletos; sin este enlace el tiquete no puede decir cuántos
   *  aprobaron, reprobaron o se retiraron. */
  originGroupId?: string | null,
  // `id` sale también cuando el tiquete YA existía: quien llama lo necesita
  // para enlazarle los pagos, y ese enlace tiene que ser idempotente igual que
  // la creación.
): Promise<{ created: boolean; id?: string; reason?: string }> {
  const supabase = createAdminClient()
  const [{ data: g }, { count }] = await Promise.all([
    supabase.from('study_groups')
      .select('id, max_students, folletos_sede, leader_id, co_leader_id, plan:study_plans(code)')
      .eq('id', groupId).maybeSingle(),
    // 'pendiente_de_pago' cuenta: los que avanzan por cierre entran así (la
    // matrícula es efectiva de inmediato y el cobro va aparte), y si no se
    // contaran, el grupo sucesor tendría 0 y nunca pediría folletos.
    supabase.from('study_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId).in('status', ['enrolled', 'pendiente_de_pago']),
  ])
  const row = g as { id: string; max_students: number | null; folletos_sede: string | null; leader_id: string | null; co_leader_id: string | null; plan: { code: string | null } | { code: string | null }[] | null } | null
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
  // El dirigente y el co-dirigente también dan el estudio y también necesitan
  // folleto: se guardan aparte de `quantity` para que el desglose sea visible y
  // para no reinterpretar lo que `quantity` significa en los tiquetes viejos.
  const folletosDeDirigentes = (row.leader_id ? 1 : 0) + (row.co_leader_id ? 1 : 0)
  const { data: creado, error } = await supabase.from('folleto_requests').insert({
    tipo,
    source_group_id: groupId,
    origin_group_id: originGroupId ?? null,
    source_plan_code: code,
    target_level_code: code,
    quantity: enrolled,
    quantity_leaders: folletosDeDirigentes,
    sede,
    close_date: todayIso,
    available_at: estimatedAvailableDate(todayIso),
  }).select('id').single()
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      // Los MISMOS tipos del índice único parcial folleto_requests_auto_por_grupo,
      // no "todo lo que no sea manual": hay tipos fuera del índice (bloque) y
      // con ellos maybeSingle() podría toparse con dos filas y reventar.
      const { data: previo } = await supabase.from('folleto_requests')
        .select('id').eq('source_group_id', groupId)
        .in('tipo', ['cupo_lleno', 'fin_matricula', 'cierre']).maybeSingle()
      return { created: false, id: (previo as { id: string } | null)?.id, reason: 'ya_existe' }
    }
    throw error
  }
  const folletoId = (creado as { id: string }).id

  // El correo se arma desde el MISMO detalle que muestra la pantalla, no de
  // variables sueltas: así los dos dicen lo mismo y no se desincronizan.
  // Best-effort — un tiquete creado no se pierde porque falle el aviso.
  try {
    const detalle = await getFolletoDetalle(folletoId)
    if (detalle) {
      const { asuntoFolleto, cuerpoFolleto, etiquetaTipo } = await import('@/lib/email/folleto-request-notify')
      const { renderEmail } = await import('@/lib/email/baseLayout')
      await notifyFolletoRecipients({
        title: 'Folletos solicitados',
        body: `${detalle.desglose.total} folletos de ${detalle.nivel ?? 'estudio'} · ${sede ?? 'sede sin definir'} (${etiquetaTipo(tipo)})`,
        subject: asuntoFolleto(detalle),
        html: renderEmail(cuerpoFolleto(detalle)),
        link: `/estudios/folletos/${folletoId}`,
      })
    }
  } catch (e) {
    console.warn('folletos: tiquete creado pero el aviso falló:', e)
  }
  return { created: true, id: folletoId }
}

/** Enlaza al tiquete de folletos los pagos pendientes de los estudiantes de ese
 *  grupo.
 *
 *  Los pagos siguen siendo INDIVIDUALES, uno por estudiante: acá no se crea ni
 *  se agrupa nada, solo se sella `payments.folleto_request_id`. Es lo que
 *  sobrevive a Tilopay — cuando entre la pasarela, cada estudiante paga el
 *  suyo y lo único que desaparece es la capa de comprobantes del dirigente.
 *
 *  No toca pagos que ya tengan tiquete: el cierre se puede reintentar
 *  (reconciliación YA_CERRADO) y esto debe poder correr dos veces.
 *
 *  Devuelve 0 sin ruido cuando el nivel es gratis (DIS2, DIS3): ahí no hay
 *  pagos que enlazar porque el folleto se pagó al matricularse en DIS1. */
export async function linkPaymentsToFolletoRequest(
  groupId: string,
  folletoRequestId: string,
): Promise<{ linked: number }> {
  const supabase = createAdminClient()
  const { data: enr } = await supabase
    .from('study_enrollments').select('id').eq('group_id', groupId)
  const ids = ((enr ?? []) as Array<{ id: string }>).map(e => e.id)
  if (ids.length === 0) return { linked: 0 }

  // .in() por tandas: un grupo grande pasado entero arma una URL que PostgREST
  // rechaza.
  let linked = 0
  for (let i = 0; i < ids.length; i += 200) {
    const { count, error } = await supabase
      .from('payments')
      .update({ folleto_request_id: folletoRequestId }, { count: 'exact' })
      .in('enrollment_id', ids.slice(i, i + 200))
      .is('folleto_request_id', null)
    if (error) throw error
    linked += count ?? 0
  }
  return { linked }
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
  const filas = (data ?? []) as Array<Record<string, unknown>>

  // Pagos individuales colgados de cada tiquete. Una sola query para toda la
  // lista (no una por fila) y se cuenta en memoria: son decenas de filas, no
  // vale una vista ni un rpc.
  const pagos = new Map<string, { total: number; pagados: number }>()
  if (filas.length > 0) {
    const { data: pays } = await supabase
      .from('payments')
      .select('folleto_request_id, status')
      .in('folleto_request_id', filas.map(f => String(f.id)))
    for (const p of (pays ?? []) as Array<{ folleto_request_id: string | null; status: string | null }>) {
      if (!p.folleto_request_id) continue
      const acc = pagos.get(p.folleto_request_id) ?? { total: 0, pagados: 0 }
      acc.total++
      if (p.status === 'paid') acc.pagados++
      pagos.set(p.folleto_request_id, acc)
    }
  }

  return filas.map(row => ({
    ...row,
    source_group: Array.isArray(row.source_group) ? (row.source_group[0] ?? null) : row.source_group,
    bloque: Array.isArray(row.bloque) ? (row.bloque[0] ?? null) : row.bloque,
    target_leader: Array.isArray(row.target_leader) ? (row.target_leader[0] ?? null) : row.target_leader,
    pagos: pagos.get(String(row.id)) ?? { total: 0, pagados: 0 },
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

/* ────────────────────────────────────────────────────────────────────────────
 * FOL-3 (2026-09-02) · Detalle de un tiquete
 *
 * Un tiquete traía nivel, cantidad y sede, y con eso quien imprime no podía
 * trabajar: no sabía a quién entregarle, dónde se da el estudio, ni de dónde
 * salía la cantidad. Esto junta todo en una sola lectura, y lo usan por igual
 * la pantalla de detalle y el correo de aviso — así los dos dicen lo mismo.
 * ──────────────────────────────────────────────────────────────────────────── */

export type FolletoGrupoInfo = {
  id: string
  name: string | null
  nivel: string | null
  dirigente: string | null
  co_dirigente: string | null
  /** Dónde se da el estudio (no dónde se entregan los folletos). */
  ubicacion: string | null
  zona: string | null
  es_virtual: boolean
  dia: string | null
  hora: string | null
  starts_at: string | null
}

/** Cómo terminó el grupo que se cerró. Solo existe en tiquetes de tipo 'cierre'. */
export type FolletoCierreInfo = { grupo: FolletoGrupoInfo } & ConteoCierre

export type FolletoDetalle = {
  id: string
  tipo: string
  status: FolletoState
  nivel: string | null
  sede_entrega: string | null
  close_date: string
  available_at: string
  note: string | null
  created_at: string
  /** Desglose de la cantidad: estudiantes + dirigentes. */
  desglose: DesgloseFolletos
  /** Grupo que va a USAR los folletos. */
  grupo: FolletoGrupoInfo | null
  /** Grupo que se cerró y disparó el tiquete. null en cupo_lleno/fin_matricula. */
  cierre: FolletoCierreInfo | null
  pagos: { total: number; pagados: number }
  /** Destinatario de una solicitud manual. */
  target_leader_name: string | null
}

type GrupoRow = {
  id: string
  name: string | null
  location: string | null
  zone: string | null
  is_virtual: boolean | null
  schedule_days: string | null
  schedule_time: string | null
  starts_at: string | null
  leader_id: string | null
  co_leader_id: string | null
  plan: { name: string | null } | { name: string | null }[] | null
  leader: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
  co_leader: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
}

const GRUPO_SELECT =
  'id, name, location, zone, is_virtual, schedule_days, schedule_time, starts_at, leader_id, co_leader_id,'
  + ' plan:study_plans(name),'
  + ' leader:members!study_groups_leader_id_fkey(first_name, last_name),'
  + ' co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name)'

function uno<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function nombre(p: { first_name: string | null; last_name: string | null } | null): string | null {
  if (!p) return null
  const n = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
  return n || null
}

function aGrupoInfo(row: GrupoRow | null): FolletoGrupoInfo | null {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    nivel: uno(row.plan)?.name ?? null,
    dirigente: nombre(uno(row.leader)),
    co_dirigente: nombre(uno(row.co_leader)),
    ubicacion: row.location,
    zona: row.zone,
    es_virtual: row.is_virtual === true,
    dia: row.schedule_days,
    hora: row.schedule_time,
    starts_at: row.starts_at,
  }
}

/** Cuenta cómo terminó cada quien en un grupo ya cerrado.
 *
 *  Se trae `notes` porque el RPC `close_group` guarda la reprobación AHÍ y no
 *  en el status — la regla, con sus tests, vive en close-result-read. Leer solo
 *  el status contaría a esos reprobados como aprobados. */
async function contarResultados(groupId: string): Promise<ConteoCierre> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('study_enrollments').select('status, notes').eq('group_id', groupId)
  return contarResultadosCierre((data ?? []) as Array<{ status: string | null; notes: string | null }>)
}

export async function getFolletoDetalle(id: string): Promise<FolletoDetalle | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('folleto_requests')
    .select('id, tipo, status, target_level_code, quantity, quantity_leaders, sede, close_date, available_at, note, created_at, source_group_id, origin_group_id, target_leader_name')
    .eq('id', id).maybeSingle()
  if (error) throw error
  const t = data as {
    id: string; tipo: string; status: FolletoState; target_level_code: string | null
    quantity: number; quantity_leaders: number | null; sede: string | null
    close_date: string; available_at: string; note: string | null; created_at: string
    source_group_id: string | null; origin_group_id: string | null; target_leader_name: string | null
  } | null
  if (!t) return null

  const [grupoRes, origenRes, pagosRes] = await Promise.all([
    t.source_group_id
      ? supabase.from('study_groups').select(GRUPO_SELECT).eq('id', t.source_group_id).maybeSingle()
      : Promise.resolve({ data: null }),
    t.origin_group_id
      ? supabase.from('study_groups').select(GRUPO_SELECT).eq('id', t.origin_group_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('payments').select('status').eq('folleto_request_id', t.id),
  ])

  const grupo = aGrupoInfo(grupoRes.data as GrupoRow | null)
  const origen = aGrupoInfo(origenRes.data as GrupoRow | null)

  // Los tiquetes anteriores al 2026-09-02 no tienen quantity_leaders: ahí el
  // desglose se deduce del grupo, que es la mejor lectura disponible. No se
  // reescribe `quantity` — sigue siendo la cantidad de estudiantes.
  const desglose = t.quantity_leaders == null
    ? desgloseFolletos({
      estudiantes: t.quantity,
      tieneDirigente: !!grupo?.dirigente,
      tieneCoDirigente: !!grupo?.co_dirigente,
    })
    : { estudiantes: t.quantity, dirigentes: t.quantity_leaders, total: t.quantity + t.quantity_leaders }

  const pagos = ((pagosRes.data ?? []) as Array<{ status: string | null }>)
  return {
    id: t.id,
    tipo: t.tipo,
    status: t.status,
    nivel: levelLabel(t.target_level_code),
    sede_entrega: t.sede,
    close_date: t.close_date,
    available_at: t.available_at,
    note: t.note,
    created_at: t.created_at,
    desglose,
    grupo,
    cierre: origen ? { grupo: origen, ...(await contarResultados(origen.id)) } : null,
    pagos: { total: pagos.length, pagados: pagos.filter(p => p.status === 'paid').length },
    target_leader_name: t.target_leader_name,
  }
}

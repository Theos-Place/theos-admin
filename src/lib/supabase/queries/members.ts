import { createAdminClient } from '@/lib/supabase/admin'
import type { MemberRole } from '@/types/member'

// NOTA: usamos createAdminClient (service role key) porque la app todavía
// corre con mock auth — sin JWT de Supabase, RLS bloquearía todas las reads.
// Cuando migremos a Supabase Auth real, cambiar a createClient de server.ts
// y dejar que RLS haga su trabajo.

// ── Tipos ──────────────────────────────────────────────────

/** Fila cruda de la tabla `members` en Supabase. Para el tipo de dominio completo
 *  ver `Member` en `@/types/member`. Usar `toDomainMember()` en `@/lib/members/adapter` para convertir. */
export type DbMember = {
  id: string
  cedula: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  gender: 'M' | 'F' | 'otro' | null
  marital_status: string | null
  phone: string | null
  email: string | null
  province: string | null
  canton: string | null
  district: string | null
  address: string | null
  occupation: string | null
  workplace: string | null
  allergies: string | null
  medications: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  photo_url: string | null
  is_donor: boolean
  is_active: boolean
  deactivation_reason: string | null
  deactivated_at: string | null
  sede_id: string | null
  field_updated_at: Record<string, string> | null
  created_at: string
  updated_at: string
}

/** DbMember + datos relacionados que se traen en una sola query para el list view. */
export type DbMemberEnriched = DbMember & {
  sede: { code: string; name: string } | null
  roles: MemberRole[]
  /** Sub-estado del rol 'dirigente' activo (null si no es dirigente). */
  estado_dirigente: 'activo' | 'en_descanso' | 'disponible' | null
  is_server: boolean
  current_study: string | null
  current_study_week?: number | null
  completed_studies: string[]
  attendance_months?: string[]
  active_service: {
    position: string
    committee: string
    area: string
    from: string | null
  } | null
}

export type MemberFilters = {
  search?: string
  province?: string
  is_active?: boolean
  is_donor?: boolean
  is_server?: boolean
  active_attendance?: boolean
  gender?: string
  ids?: string[]
  page?: number
  pageSize?: number
}

/** member_ids con al menos un voluntariado activo (mismo criterio que la página de servidores). */
export async function getServerMemberIds(): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('volunteers').select('member_id').eq('status', 'active')
    if (error) {
      console.warn('getServerMemberIds:', error.message)
      return []
    }
    return Array.from(new Set((data ?? []).map((r) => (r as { member_id: string }).member_id)))
  } catch (e) {
    console.warn('getServerMemberIds:', e)
    return []
  }
}

/** Últimos 6 meses calendario (YYYY-MM), incluyendo el mes actual. */
function last6MonthsKeys(now = new Date()): string[] {
  const out: string[] = []
  const d = new Date(now)
  for (let i = 0; i < 6; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

/** member_ids con al menos una asistencia en cada uno de los últimos 6 meses.
 *  Si no hay datos de asistencia (o la tabla falla), devuelve [] — nunca lanza. */
export async function getActiveAttendanceMemberIds(): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const months = last6MonthsKeys()
    const oldest = `${months[months.length - 1]}-01` // inicio del mes más viejo
    const { data, error } = await supabase
      .from('event_checkins').select('member_id, checked_in_at').gte('checked_in_at', oldest)
    if (error || !data) {
      if (error) console.warn('getActiveAttendanceMemberIds:', error.message)
      return []
    }
    const byMember = new Map<string, Set<string>>()
    for (const r of data as Array<{ member_id: string | null; checked_in_at: string | null }>) {
      if (!r?.member_id || !r?.checked_in_at) continue
      const mo = r.checked_in_at.slice(0, 7)
      if (!byMember.has(r.member_id)) byMember.set(r.member_id, new Set())
      byMember.get(r.member_id)!.add(mo)
    }
    const need = new Set(months)
    const out: string[] = []
    for (const [id, set] of byMember) {
      if ([...need].every((m) => set.has(m))) out.push(id)
    }
    return out
  } catch (e) {
    console.warn('getActiveAttendanceMemberIds:', e)
    return []
  }
}

export type MemberCounts = {
  total: number
  donadores: number
  servidores: number
  activos_asistencia: number
}

/** Conteos para los chips/header. Mismas definiciones que las páginas de cada módulo. */
export async function getMemberCounts(): Promise<MemberCounts> {
  const supabase = createAdminClient()
  const countWhere = async (col: string, val: boolean) => {
    try {
      const { count } = await supabase.from('members').select('id', { count: 'exact', head: true }).eq(col, val)
      return count ?? 0
    } catch (e) {
      console.warn(`getMemberCounts(${col}):`, e)
      return 0
    }
  }
  const totalP = (async () => {
    try {
      const { count } = await supabase.from('members').select('id', { count: 'exact', head: true }).eq('is_active', true)
      return count ?? 0
    } catch (e) {
      console.warn('getMemberCounts(total):', e)
      return 0
    }
  })()
  const [total, donadores, serverIds, attendanceIds] = await Promise.all([
    totalP,
    countWhere('is_donor', true),
    getServerMemberIds(),          // ya resiliente (devuelve [])
    getActiveAttendanceMemberIds(),// ya resiliente (devuelve [])
  ])
  return { total, donadores, servidores: serverIds.length, activos_asistencia: attendanceIds.length }
}

/** Aplica búsqueda de texto sobre miembros: nombre, apellidos, cédula, teléfono y
 *  email. Tokeniza por espacios — cada palabra debe coincidir en algún campo (AND
 *  entre palabras), así "Juan Pérez" matchea nombre+apellido. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMemberSearch<T extends { or: (f: string) => any }>(query: T, search: string): T {
  let q = query
  for (const tok of search.trim().split(/\s+/)) {
    const s = tok.replace(/[%,().]/g, '')
    if (!s) continue
    q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,cedula.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`)
  }
  return q
}

/** Solo los IDs (y total) que coinciden con los filtros, sin paginar. Liviano:
 *  select('id'). Sirve para guardar listas / acciones sobre "todos los resultados". */
export async function getMemberIds(filters: MemberFilters = {}): Promise<{ ids: string[]; total: number }> {
  const supabase = createAdminClient()
  const { search, is_active = true, is_donor, is_server, active_attendance } = filters

  let idFilter: string[] | null = null
  if (active_attendance) {
    const ids = await getActiveAttendanceMemberIds()
    if (ids.length === 0) return { ids: [], total: 0 }
    idFilter = ids
  }

  // PostgREST corta cada respuesta en ~1000 filas (db-max-rows), así que un
  // range gigante trunca silenciosamente: paginamos hasta agotar, con orden
  // estable para que las páginas no se solapen. El Set dedup ids repetidos
  // por el inner join con volunteers.
  const pageSize = 1000
  const ids = new Set<string>()
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('members')
      .select(is_server ? 'id, volunteers!inner(status)' : 'id')
      .eq('is_active', is_active)
      .order('id')
      .range(from, from + pageSize - 1)

    if (search) {
      query = applyMemberSearch(query, search)
    }
    if (is_donor !== undefined) query = query.eq('is_donor', is_donor)
    if (is_server) query = query.eq('volunteers.status', 'active')
    if (idFilter) query = query.in('id', idFilter)

    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []) as unknown as Array<{ id: string }>
    rows.forEach((r) => ids.add(r.id))
    if (rows.length < pageSize) break
  }
  return { ids: Array.from(ids), total: ids.size }
}

export type UserAccessRow = {
  id: string
  member_id: string
  member_name: string
  member_email: string
  member_initials: string
  roles: string[]
  granted_by: string
  granted_at: string
  last_login: string | null
  is_active: boolean
}

/** Miembros que tienen al menos un rol asignado en member_roles (gestión de accesos). */
export async function getUserAccess(): Promise<UserAccessRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, role, is_active, granted_at, member:members!member_roles_member_id_fkey(first_name, last_name, email)')
    .order('granted_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    member_id: string
    role: string
    is_active: boolean
    granted_at: string | null
    member: { first_name: string | null; last_name: string | null; email: string | null } | null
  }>

  const byMember = new Map<string, UserAccessRow>()
  for (const r of rows) {
    if (!r.member_id) continue
    const name = `${r.member?.first_name ?? ''} ${r.member?.last_name ?? ''}`.trim() || (r.member?.email ?? '')
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
    let entry = byMember.get(r.member_id)
    if (!entry) {
      entry = {
        id: r.member_id,
        member_id: r.member_id,
        member_name: name,
        member_email: r.member?.email ?? '',
        member_initials: initials,
        roles: [],
        granted_by: 'Sistema',
        granted_at: r.granted_at ?? new Date().toISOString(),
        last_login: null,
        is_active: false,
      }
      byMember.set(r.member_id, entry)
    }
    if (r.is_active && !entry.roles.includes(r.role)) entry.roles.push(r.role)
    if (r.is_active) entry.is_active = true
  }
  // Solo miembros con al menos un rol activo.
  return Array.from(byMember.values()).filter(u => u.roles.length > 0)
}

/** Asigna (o reactiva) un rol a un miembro en member_roles. */
export async function assignMemberRole(memberId: string, role: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('member_roles').select('id').eq('member_id', memberId).eq('role', role).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('member_roles')
      .update({ is_active: true, revoked_at: null }).eq('id', (existing as { id: string }).id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('member_roles')
      .insert({ member_id: memberId, role, is_active: true })
    if (error) throw error
  }
}

/** Revoca un rol (is_active=false, conserva el historial). */
export async function revokeMemberRole(memberId: string, role: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('member_roles')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('member_id', memberId).eq('role', role)
  if (error) throw error
}

// ── Queries ────────────────────────────────────────────────

/** Lista paginada de miembros con datos relacionados ligeros para el list view.
 *  Incluye: sede, roles activos, flag is_server, estudio actual/completados, servicio activo. */
export async function getMembers(filters: MemberFilters = {}): Promise<{ members: DbMemberEnriched[]; total: number }> {
  const supabase = createAdminClient()
  const {
    search,
    province,
    is_active = true,
    is_donor,
    is_server,
    active_attendance,
    gender,
    ids,
    page = 1,
    pageSize = 50,
  } = filters

  // active_attendance: lista de member_ids (hoy pocos/0; a escala conviene un RPC).
  let idFilter: string[] | null = null
  if (active_attendance) {
    const aids = await getActiveAttendanceMemberIds()
    if (aids.length === 0) return { members: [], total: 0 } // sin datos → 0 resultados, sin query
    idFilter = aids
  }
  // ids explícitos (p. ej. integrantes de una lista guardada).
  if (ids) {
    if (ids.length === 0) return { members: [], total: 0 }
    idFilter = idFilter ? idFilter.filter(x => ids.includes(x)) : ids
  }

  // is_server: inner join a volunteers activos (evita listas de ids enormes en la URL).
  const volunteersEmbed = is_server
    ? `volunteers!inner(status, start_date, service_positions(title, area:areas(name, parent:areas!parent_id(name))))`
    : `volunteers(status, start_date, service_positions(title, area:areas(name, parent:areas!parent_id(name))))`

  let query = supabase
    .from('members')
    .select(
      `
      *,
      sede:sedes(code, name),
      member_roles!member_roles_member_id_fkey(role, is_active, status_detail),
      ${volunteersEmbed},
      study_enrollments(
        status,
        study_groups!study_enrollments_group_id_fkey(plan:study_plans(name))
      ),
      event_checkins(checked_in_at)
    `,
      { count: 'exact' },
    )
    .eq('is_active', is_active)
    .order('last_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (is_server) query = query.eq('volunteers.status', 'active')

  if (search) {
    query = applyMemberSearch(query, search)
  }
  if (province) query = query.eq('province', province)
  if (is_donor !== undefined) query = query.eq('is_donor', is_donor)
  if (gender) query = query.eq('gender', gender)
  if (idFilter) query = query.in('id', idFilter)

  const { data, error, count } = await query

  if (error) throw error

  // ─── Aplanar las relaciones a un shape simple ───
  // Supabase devuelve arrays para todas las relaciones. Las agrupamos / pickeamos acá.
  const enriched: DbMemberEnriched[] = (data ?? []).map((row: Record<string, unknown>) => {
    const memberRoles = (row.member_roles as Array<{
      role: MemberRole
      is_active: boolean
      status_detail: 'activo' | 'en_descanso' | 'disponible' | null
    }> | null) ?? []
    const volunteers = (row.volunteers as Array<{
      status: string
      start_date: string | null
      service_positions: {
        title: string
        area: { name: string; parent: { name: string } | null } | null
      } | null
    }> | null) ?? []
    const enrollments = (row.study_enrollments as Array<{
      status: string
      study_groups: { plan: { name: string } | null } | null
    }> | null) ?? []

    const activeRoles = memberRoles.filter(r => r.is_active).map(r => r.role)
    const activeDirigente = memberRoles.find(r => r.is_active && r.role === 'dirigente')
    const estadoDirigente = activeDirigente?.status_detail ?? null
    const activeVolunteer = volunteers.find(v => v.status === 'active') ?? null

    const completedStudies = enrollments
      .filter(e => e.status === 'completed' && e.study_groups?.plan?.name)
      .map(e => e.study_groups!.plan!.name)

    const currentStudy = enrollments
      .find(e => e.status === 'enrolled' && e.study_groups?.plan?.name)
      ?.study_groups?.plan?.name ?? null

    const sede = (row.sede as { code: string; name: string } | null) ?? null

    // Meses (YYYY-MM) con al menos una asistencia — para el filtro "Activo (asistencia)".
    const checkins = (row.event_checkins as Array<{ checked_in_at: string | null }> | null) ?? []
    const attendanceMonths = Array.from(new Set(
      checkins.map(c => (c.checked_in_at ?? '').slice(0, 7)).filter(Boolean),
    ))

    return {
      ...(row as DbMember),
      sede,
      roles: activeRoles,
      estado_dirigente: estadoDirigente,
      is_server: volunteers.some(v => v.status === 'active'),
      current_study: currentStudy,
      completed_studies: completedStudies,
      attendance_months: attendanceMonths,
      active_service: activeVolunteer && activeVolunteer.service_positions
        ? {
            position: activeVolunteer.service_positions.title,
            committee: activeVolunteer.service_positions.area?.name ?? '',
            area: activeVolunteer.service_positions.area?.parent?.name
              ?? activeVolunteer.service_positions.area?.name
              ?? '',
            from: activeVolunteer.start_date,
          }
        : null,
    }
  })

  return { members: enriched, total: count ?? 0 }
}

export async function getMemberById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as DbMember
}

// ── Helpers para detail view ──────────────────────────────────────────────────

type AdminSupabase = ReturnType<typeof createAdminClient>

async function loadFamily(supabase: AdminSupabase, memberId: string): Promise<DbFamilyMember[]> {
  // 1. family_unit_id donde el miembro tiene vínculos
  const { data: ownLinks, error: e1 } = await supabase
    .from('family_members')
    .select('family_unit_id')
    .eq('member_id', memberId)
  if (e1) throw e1

  const unitIds = (ownLinks ?? []).map(r => r.family_unit_id).filter(Boolean) as string[]
  if (unitIds.length === 0) return []

  // 2. Otros miembros en esos family units
  const { data: links, error: e2 } = await supabase
    .from('family_members')
    .select(`
      relation,
      member:members!family_members_member_id_fkey(id, first_name, last_name, is_active)
    `)
    .in('family_unit_id', unitIds)
    .neq('member_id', memberId)
  if (e2) throw e2

  return (links ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const m = row.member as { id: string; first_name: string; last_name: string; is_active: boolean } | null
    return {
      id: m?.id ?? '',
      name: m ? `${m.first_name} ${m.last_name}` : '',
      relation: (row.relation as string) ?? '',
      is_active: m?.is_active ?? false,
    }
  }).filter(f => f.id)
}

// ── Detail view: trae miembro + todo el histórico relacionado ─────────────────

export type DbAttendance = {
  event_name: string
  event_type: string
  event_date: string
  was_volunteer: boolean
}

export type DbService = {
  position: string
  committee: string
  area: string
  from: string | null
  to: string | null
  status: 'active' | 'inactive' | 'on_leave' | 'pending'
}

export type DbDonation = {
  date: string
  amount: number
  description: string
  category: string
}

export type DbFormResponse = {
  form_id: string
  form_slug: string | null
  form_title: string
  submitted_at: string
  answers: Record<string, string>
}

export type DbFamilyMember = {
  id: string
  name: string
  relation: string
  is_active: boolean
}

export type DbMemberFull = DbMemberEnriched & {
  study_history: Array<{ group_id: string | null; code: string; name: string; date: string | null; year: number | null; weeks: number | null; status: string }>
  attendance: DbAttendance[]
  service_history: DbService[]
  donations: DbDonation[]
  form_responses: DbFormResponse[]
  family: DbFamilyMember[]
  wallet_pass_id: string | null
}

/** Devuelve un miembro con TODO su histórico relacionado. Para el detail view. */
export async function getMemberFullById(id: string): Promise<DbMemberFull | null> {
  const supabase = createAdminClient()

  // 1. Miembro + relaciones livianas (mismo shape que list view)
  const { data: memberRow, error: mErr } = await supabase
    .from('members')
    .select(`
      *,
      sede:sedes(code, name),
      member_roles!member_roles_member_id_fkey(role, is_active, status_detail),
      volunteers(
        status,
        start_date,
        end_date,
        service_positions(
          title,
          area:areas(name, parent:areas!parent_id(name))
        )
      ),
      study_enrollments(
        status, completed_at, enrolled_at,
        study_groups!study_enrollments_group_id_fkey(id, current_week, starts_at, leader_id, co_leader_id, plan:study_plans(code, name, duration_weeks)),
        plan_direct:study_plans!study_enrollments_plan_id_fkey(code, name, duration_weeks)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (mErr) throw mErr
  if (!memberRow) return null

  // 2. Queries en paralelo para histórico pesado
  const [
    checkinsRes,
    volunteersRes,
    paymentsRes,
    donationsRes,
    formsRes,
  ] = await Promise.all([
    supabase
      .from('event_checkins')
      .select(`
        event_id,
        checked_in_at,
        events(title, event_type, starts_at)
      `)
      .eq('member_id', id)
      .order('checked_in_at', { ascending: false }),

    supabase
      .from('event_volunteers')
      .select('event_id')
      .eq('member_id', id),

    supabase
      .from('payments')
      .select(`
        amount,
        payment_date,
        description,
        category:payment_categories(name, is_donation)
      `)
      .eq('member_id', id)
      .eq('status', 'paid') // estados reales de payments (014): paid/pending/refunded/…
      .order('payment_date', { ascending: false }),

    supabase
      .from('donations')
      .select('donation_date, amount, source_file')
      .eq('member_id', id)
      .order('donation_date', { ascending: false }),

    supabase
      .from('form_responses')
      .select(`
        form_id,
        submitted_at,
        forms(title, slug),
        form_response_values(
          value_text,
          form_fields(label)
        )
      `)
      .eq('member_id', id)
      .order('submitted_at', { ascending: false }),
  ])

  if (checkinsRes.error)   throw checkinsRes.error
  if (volunteersRes.error) throw volunteersRes.error
  if (paymentsRes.error)   throw paymentsRes.error
  if (donationsRes.error)  throw donationsRes.error
  if (formsRes.error)      throw formsRes.error

  // Set de event_ids donde el miembro sirvió como voluntario
  const volunteerEventIds = new Set(
    (volunteersRes.data ?? []).map((v) => (v as { event_id: string }).event_id),
  )

  // 3. Aplanar relaciones del miembro (sede, roles, volunteers, studies)
  const memberRoles = (memberRow.member_roles ?? []) as Array<{
    role: MemberRole
    is_active: boolean
    status_detail: 'activo' | 'en_descanso' | 'disponible' | null
  }>
  const volunteers = (memberRow.volunteers ?? []) as Array<{
    status: 'active' | 'inactive' | 'on_leave' | 'pending'
    start_date: string | null
    end_date: string | null
    service_positions: {
      title: string
      area: { name: string; parent: { name: string } | null } | null
    } | null
  }>
  type PlanEmbed = { code: string | null; name: string | null; duration_weeks: number | null } | null
  const enrollments = (memberRow.study_enrollments ?? []) as Array<{
    status: string
    completed_at: string | null
    enrolled_at: string | null
    study_groups: { id: string; current_week: number | null; starts_at: string | null; leader_id: string | null; co_leader_id: string | null; plan: PlanEmbed } | null
    plan_direct: PlanEmbed
  }>

  const activeRoles = memberRoles.filter(r => r.is_active).map(r => r.role)
  const activeDirigente = memberRoles.find(r => r.is_active && r.role === 'dirigente')
  const estadoDirigente = activeDirigente?.status_detail ?? null
  const activeVolunteer = volunteers.find(v => v.status === 'active') ?? null
  // El plan puede venir del grupo o, si el estudio no tuvo grupo (sistema no
  // existía), directo de la inscripción (plan_direct). Excluimos lo que la
  // persona dirigió (solo aplica a estudios con grupo).
  const planOf = (e: typeof enrollments[number]) => e.study_groups?.plan ?? e.plan_direct
  const ledByMember = (e: typeof enrollments[number]) =>
    !!e.study_groups && (e.study_groups.leader_id === id || e.study_groups.co_leader_id === id)
  const completedStudies = enrollments
    .filter(e => e.status === 'completed' && planOf(e)?.name && !ledByMember(e))
    .map(e => planOf(e)!.name as string)
  // Historial de estudios con fecha real (del grupo si existe; si no, de la inscripción).
  const studyHistory = enrollments
    .filter(e => planOf(e)?.code && !ledByMember(e))
    .map(e => {
      const plan = planOf(e)!
      // completed_at trae la fecha precisa del histórico (PCO); si falta (ej.
      // inscripción activa), caemos a la fecha de inicio del grupo o enrolled_at.
      const d = e.completed_at ?? e.study_groups?.starts_at ?? e.enrolled_at ?? null
      return {
        group_id: e.study_groups?.id ?? null,
        code: plan.code as string,
        name: plan.name ?? '',
        date: d ? d.slice(0, 10) : null,
        year: d ? Number(d.slice(0, 4)) : null,
        weeks: plan.duration_weeks ?? null,
        status: e.status,
      }
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const currentEnrollment = enrollments
    .find(e => e.status === 'enrolled' && e.study_groups?.plan?.name)
  const currentStudy = currentEnrollment?.study_groups?.plan?.name ?? null
  const currentStudyWeek = currentEnrollment?.study_groups?.current_week ?? null
  const sede = (memberRow.sede as { code: string; name: string } | null) ?? null

  // 4. Aplanar histórico
  const attendance: DbAttendance[] = (checkinsRes.data ?? []).map((c) => {
    const row = c as Record<string, unknown>
    const ev = row.events as { title: string; event_type: string; starts_at: string } | null
    return {
      event_name: ev?.title ?? '',
      event_type: ev?.event_type ?? 'otro',
      event_date: ev?.starts_at ?? row.checked_in_at as string,
      was_volunteer: volunteerEventIds.has(row.event_id as string),
    }
  })

  const service_history: DbService[] = volunteers
    .filter(v => v.service_positions)
    .map(v => ({
      position: v.service_positions!.title,
      committee: v.service_positions!.area?.name ?? '',
      area: v.service_positions!.area?.parent?.name
        ?? v.service_positions!.area?.name
        ?? '',
      from: v.start_date,
      to: v.end_date,
      status: v.status,
    }))

  // Donaciones: la tabla donations (incluye las históricas importadas con
  // amount 0) + pagos con categoría de donación. Para las importadas sin
  // monto, la descripción lleva el trimestre ("Donación registrada · Q3 2025").
  // Parsear el string YYYY-MM-DD directo: new Date(date-only) es UTC y al
  // leer con getters locales (UTC-6) retrocede un día → trimestre equivocado.
  const quarterLabel = (iso: string) => {
    const [y, m] = iso.split('-').map(Number)
    return `Q${Math.floor((m - 1) / 3) + 1} ${y}`
  }
  const tableDonations: DbDonation[] = ((donationsRes.data ?? []) as Array<{
    donation_date: string; amount: number | null; source_file: string | null
  }>).map((d) => ({
    date: d.donation_date,
    amount: Number(d.amount ?? 0),
    description: Number(d.amount ?? 0) === 0
      ? `Donación registrada · ${quarterLabel(d.donation_date)}`
      : 'Donación',
    category: 'Donación',
  }))
  const paymentDonations: DbDonation[] = (paymentsRes.data ?? [])
    .filter((p) => {
      const cat = (p as Record<string, unknown>).category as { is_donation: boolean } | null
      return cat?.is_donation === true
    })
    .map((p) => {
      const row = p as Record<string, unknown>
      const cat = row.category as { name: string } | null
      return {
        date: row.payment_date as string,
        amount: Number(row.amount),
        description: (row.description as string) ?? '',
        category: cat?.name ?? '',
      }
    })
  const donations: DbDonation[] = [...tableDonations, ...paymentDonations]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const form_responses: DbFormResponse[] = (formsRes.data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const form = row.forms as { title: string; slug: string | null } | null
    const values = (row.form_response_values as Array<{
      value_text: string | null
      form_fields: { label: string } | null
    }> | null) ?? []
    const answers: Record<string, string> = {}
    for (const v of values) {
      if (v.form_fields?.label && v.value_text != null) {
        answers[v.form_fields.label] = v.value_text
      }
    }
    return {
      form_id: row.form_id as string,
      form_slug: form?.slug ?? null,
      form_title: form?.title ?? '',
      submitted_at: row.submitted_at as string,
      answers,
    }
  })

  // Familia: dos queries — primero los family_unit_id del miembro, después
  // los OTROS miembros de esos units.
  const family: DbFamilyMember[] = await loadFamily(supabase, id)

  return {
    ...(memberRow as DbMember),
    sede,
    roles: activeRoles,
    estado_dirigente: estadoDirigente,
    is_server: volunteers.some(v => v.status === 'active'),
    current_study: currentStudy,
    current_study_week: currentStudyWeek,
    completed_studies: completedStudies,
    study_history: studyHistory,
    active_service: activeVolunteer && activeVolunteer.service_positions
      ? {
          position: activeVolunteer.service_positions.title,
          committee: activeVolunteer.service_positions.area?.name ?? '',
          area: activeVolunteer.service_positions.area?.parent?.name
            ?? activeVolunteer.service_positions.area?.name
            ?? '',
          from: activeVolunteer.start_date,
        }
      : null,
    attendance,
    service_history,
    donations,
    form_responses,
    family,
    wallet_pass_id: (memberRow.wallet_pass_id as string | null) ?? null,
  }
}

/** Busca un miembro existente por cédula o correo (para evitar duplicados al crear).
 *  Dos .eq() separados en vez de .or(): .or() interpola el valor en la sintaxis
 *  de PostgREST, así que comas/paréntesis del input alteran el filtro. */
export async function findMemberByCedulaOrEmail(cedula: string | null, email: string | null) {
  if (!cedula && !email) return null
  const supabase = createAdminClient()
  const lookup = (col: 'cedula' | 'email', val: string) =>
    supabase.from('members').select('id').eq(col, val).limit(1).maybeSingle()

  const [byCedula, byEmail] = await Promise.all([
    cedula ? lookup('cedula', cedula) : null,
    email ? lookup('email', email) : null,
  ])
  if (byCedula?.error) throw byCedula.error
  if (byEmail?.error) throw byEmail.error
  return (byCedula?.data ?? byEmail?.data ?? null) as { id: string } | null
}

/** Fusiona dos miembros duplicados: reasigna todo lo de `dupId` a `keepId` y
 *  borra el duplicado. Corre la función transaccional `merge_members` en la BD. */
export async function mergeMembers(
  keepId: string,
  dupId: string,
  opts?: { fields?: Record<string, unknown>; soft?: boolean },
): Promise<void> {
  const supabase = createAdminClient()

  // Merge campo-por-campo: actualizar el perfil principal con los valores elegidos
  // y sellar field_updated_at de los campos modificados con la fecha actual.
  if (opts?.fields && Object.keys(opts.fields).length > 0) {
    const { data: cur } = await supabase
      .from('members').select('field_updated_at').eq('id', keepId).maybeSingle()
    const now = new Date().toISOString()
    const stamp = { ...((cur as { field_updated_at?: Record<string, string> } | null)?.field_updated_at ?? {}) }
    for (const k of Object.keys(opts.fields)) stamp[k] = now
    const { error: uErr } = await supabase
      .from('members').update({ ...opts.fields, field_updated_at: stamp }).eq('id', keepId)
    if (uErr) throw uErr
  }

  const { error } = await supabase.rpc('merge_members', { keep_id: keepId, dup_id: dupId, soft: opts?.soft ?? false })
  if (error) throw error
}

export type DuplicateMember = {
  id: string; first_name: string; last_name: string
  cedula: string | null; email: string | null; phone: string | null; created_at: string
  birth_date: string | null; province: string | null; canton: string | null
  occupation: string | null; photo_url: string | null
  field_updated_at: Record<string, string> | null
}
export type DuplicatePair = { a: DuplicateMember; b: DuplicateMember; reasons: string[] }

/** Pares de miembros probablemente duplicados (función find_duplicate_pairs). */
export async function getDuplicatePairs(): Promise<DuplicatePair[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('find_duplicate_pairs')
  if (error) throw error
  const pairs = (data ?? []) as Array<{ member_a: string; member_b: string; reasons: string[] }>
  const ids = [...new Set(pairs.flatMap(p => [p.member_a, p.member_b]))]
  if (ids.length === 0) return []
  const { data: members, error: mErr } = await supabase
    .from('members').select('id, first_name, last_name, cedula, email, phone, created_at, birth_date, province, canton, occupation, photo_url, field_updated_at').in('id', ids)
  if (mErr) throw mErr
  const byId = new Map((members ?? []).map(m => [m.id, m as DuplicateMember]))
  return pairs
    .map(p => ({ a: byId.get(p.member_a), b: byId.get(p.member_b), reasons: p.reasons }))
    .filter((p): p is DuplicatePair => !!p.a && !!p.b)
}

/** Marca un par como "no es duplicado" (no vuelve a sugerirse). */
export async function dismissDuplicatePair(idA: string, idB: string): Promise<void> {
  const supabase = createAdminClient()
  const [a, b] = idA < idB ? [idA, idB] : [idB, idA]
  const { error } = await supabase.from('duplicate_dismissals').upsert({ member_a: a, member_b: b }, { onConflict: 'member_a,member_b' })
  if (error) throw error
}

export async function createMember(member: Omit<DbMember, 'id' | 'created_at' | 'updated_at' | 'sede_id'>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .insert(member)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}

/** Crea una family_unit e inserta a todos sus integrantes en family_members. */
export async function createFamily(input: { name: string; members: Array<{ member_id: string; relation: string }> }) {
  const supabase = createAdminClient()
  const { data: unit, error: uErr } = await supabase
    .from('family_units')
    .insert({ name: input.name })
    .select('id')
    .single()
  if (uErr) throw uErr
  const unitId = (unit as { id: string }).id

  if (input.members.length > 0) {
    const rows = input.members.map(m => ({ family_unit_id: unitId, member_id: m.member_id, relation: m.relation }))
    const { error: mErr } = await supabase.from('family_members').insert(rows)
    if (mErr) throw mErr
  }
  return { id: unitId }
}

/** Devuelve los OTROS integrantes de la(s) familia(s) de un miembro (para check-in). */
export async function getMemberFamily(memberId: string): Promise<Array<{ member_id: string; name: string; relation: string }>> {
  const supabase = createAdminClient()
  // Unidades familiares a las que pertenece el miembro.
  const { data: own, error: oErr } = await supabase
    .from('family_members')
    .select('family_unit_id')
    .eq('member_id', memberId)
  if (oErr) throw oErr
  const unitIds = (own ?? []).map((r: { family_unit_id: string }) => r.family_unit_id)
  if (unitIds.length === 0) return []

  const { data, error } = await supabase
    .from('family_members')
    .select('member_id, relation, member:members!family_members_member_id_fkey(first_name, last_name)')
    .in('family_unit_id', unitIds)
    .neq('member_id', memberId)
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{ member_id: string; relation: string; member: { first_name: string; last_name: string } | null }>
  // Dedupe por member_id (puede aparecer en varias unidades).
  const seen = new Set<string>()
  const out: Array<{ member_id: string; name: string; relation: string }> = []
  for (const r of rows) {
    if (seen.has(r.member_id)) continue
    seen.add(r.member_id)
    out.push({ member_id: r.member_id, name: `${r.member?.first_name ?? ''} ${r.member?.last_name ?? ''}`.trim(), relation: r.relation })
  }
  return out
}

export async function updateMember(id: string, updates: Partial<DbMember>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}

export async function deactivateMember(
  id: string,
  reason: string,
  deactivated_by: string,
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .update({
      is_active: false,
      deactivation_reason: reason,
      deactivated_at: new Date().toISOString(),
      deactivated_by,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}

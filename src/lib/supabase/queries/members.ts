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
  gender?: string
  page?: number
  pageSize?: number
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
    gender,
    page = 1,
    pageSize = 50,
  } = filters

  let query = supabase
    .from('members')
    .select(
      `
      *,
      sede:sedes(code, name),
      member_roles!member_roles_member_id_fkey(role, is_active, status_detail),
      volunteers(
        status,
        start_date,
        service_positions(
          title,
          area:areas(name, parent:areas!parent_id(name))
        )
      ),
      study_enrollments(
        status,
        study_groups!study_enrollments_group_id_fkey(plan:study_plans(name))
      )
    `,
      { count: 'exact' },
    )
    .eq('is_active', is_active)
    .order('last_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,cedula.ilike.%${search}%,email.ilike.%${search}%`,
    )
  }
  if (province) query = query.eq('province', province)
  if (is_donor !== undefined) query = query.eq('is_donor', is_donor)
  if (gender) query = query.eq('gender', gender)

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

    return {
      ...(row as DbMember),
      sede,
      roles: activeRoles,
      estado_dirigente: estadoDirigente,
      is_server: volunteers.some(v => v.status === 'active'),
      current_study: currentStudy,
      completed_studies: completedStudies,
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
        status,
        study_groups!study_enrollments_group_id_fkey(current_week, plan:study_plans(name))
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
      .eq('status', 'completed')
      .order('payment_date', { ascending: false }),

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
  const enrollments = (memberRow.study_enrollments ?? []) as Array<{
    status: string
    study_groups: { current_week: number | null; plan: { name: string } | null } | null
  }>

  const activeRoles = memberRoles.filter(r => r.is_active).map(r => r.role)
  const activeDirigente = memberRoles.find(r => r.is_active && r.role === 'dirigente')
  const estadoDirigente = activeDirigente?.status_detail ?? null
  const activeVolunteer = volunteers.find(v => v.status === 'active') ?? null
  const completedStudies = enrollments
    .filter(e => e.status === 'completed' && e.study_groups?.plan?.name)
    .map(e => e.study_groups!.plan!.name)
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

  const donations: DbDonation[] = (paymentsRes.data ?? [])
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

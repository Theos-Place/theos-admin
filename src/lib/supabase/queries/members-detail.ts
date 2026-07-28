// Detail view del miembro: trae el miembro + TODO su histórico relacionado.
// Extraído de members.ts (auditoría 2026-06: archivos gigantes). Re-exportado
// por members.ts para no tocar a los consumidores.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MemberRole } from '@/types/member'
import type { DbMember, DbMemberEnriched } from './members'
import { getAreaNameMap, parentAreaName } from './_area-map'
import { meetsAttendanceCriteria } from '@/lib/attendance'
import { esComiteDirigentes } from '@/lib/dirigentes'
import type { MemberSedeResult } from '@/lib/sede-attendance'

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
  /** Sede calculada por asistencia a charlas — criterio único (src/lib/sede-attendance.ts):
   *  activo = más asistida en los últimos 6 meses; inactivo = más asistida en
   *  los 6 meses previos a su última asistencia. null = nunca asistió. */
  attendance_sede: MemberSedeResult | null
  study_history: Array<{ group_id: string | null; enrollment_id: string; code: string; name: string; date: string | null; year: number | null; weeks: number | null; status: string; requires_payment: boolean; payment_status: string | null; cost: number; grade: number | null; notes: string | null }>
  event_registration_history: Array<{
    registration_id: string; event_id: string; event_name: string; event_date: string
    requires_payment: boolean; cost: number
    payment_status: 'pending' | 'paid' | 'exempted' | 'expired'
    review_status: string | null
  }>
  attendance: DbAttendance[]
  service_history: DbService[]
  donations: DbDonation[]
  form_responses: DbFormResponse[]
  family: DbFamilyMember[]
  wallet_pass_id: string | null
  attendance_active: boolean
  last_charla_checkin: string | null
  /** Grupos activos (en_matricula/en_curso) donde el miembro es dirigente o co-dirigente. */
  led_groups: Array<{ group_id: string; group_name: string; plan_code: string | null; plan_name: string | null }>
  led_studies: Array<{ group_id: string; group_name: string; plan_code: string | null; plan_name: string | null; role: 'Dirigente' | 'Co-dirigente'; status: string; date: string | null }>
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
          area:areas!service_positions_area_id_fkey(id, name)
        )
      ),
      study_enrollments(
        id, status, completed_at, enrolled_at, grade, notes,
        study_groups!study_enrollments_group_id_fkey(id, current_week, starts_at, leader_id, co_leader_id, plan:study_plans(code, name, duration_weeks, cost, requires_payment)),
        plan_direct:study_plans!study_enrollments_plan_id_fkey(code, name, duration_weeks, cost, requires_payment)
      ),
      study_leaders(member_id)
    `)
    .eq('id', id)
    .maybeSingle()

  if (mErr) throw mErr
  if (!memberRow) return null

  // Grupos activos que la persona dirige (dos .eq en vez de .or() para no
  // interpolar el id de la URL en sintaxis PostgREST).
  const ledGroupSelect = 'id, name, status, starts_at, plan:study_plans(code, name)'
  // 2. Queries en paralelo para histórico pesado
  const [
    checkinsRes,
    volunteersRes,
    paymentsRes,
    donationsRes,
    formsRes,
    leadsRes,
    coLeadsRes,
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

    // TODOS los grupos liderados (cualquier estado): led_groups filtra los activos
    // (D9) y led_studies los lista todos como dirigente (D10).
    supabase
      .from('study_groups')
      .select(ledGroupSelect)
      .eq('leader_id', id),

    supabase
      .from('study_groups')
      .select(ledGroupSelect)
      .eq('co_leader_id', id),
  ])

  if (checkinsRes.error)   throw checkinsRes.error
  if (volunteersRes.error) throw volunteersRes.error
  if (paymentsRes.error)   throw paymentsRes.error
  if (donationsRes.error)  throw donationsRes.error
  if (formsRes.error)      throw formsRes.error
  if (leadsRes.error)      throw leadsRes.error
  if (coLeadsRes.error)    throw coLeadsRes.error

  type LedGroupRow = { id: string; name: string | null; status: string; starts_at: string | null; plan: { code: string | null; name: string | null } | null }
  const allLed = [
    ...((leadsRes.data ?? []) as LedGroupRow[]).map(g => ({ ...g, role: 'Dirigente' as const })),
    ...((coLeadsRes.data ?? []) as LedGroupRow[]).map(g => ({ ...g, role: 'Co-dirigente' as const })),
  ].filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i)

  // D9: estudios en curso que dirige (activos) para el resumen.
  const ledGroups = allLed
    .filter(g => g.status === 'en_matricula' || g.status === 'en_curso')
    .map(g => ({
      group_id: g.id,
      group_name: g.name ?? '',
      plan_code: g.plan?.code ?? null,
      plan_name: g.plan?.name ?? null,
    }))

  // D10: TODOS los estudios dados como dirigente (cualquier estado) para el perfil.
  const ledStudies = allLed
    .map(g => ({
      group_id: g.id,
      group_name: g.name ?? '',
      plan_code: g.plan?.code ?? null,
      plan_name: g.plan?.name ?? null,
      role: g.role,
      status: g.status,
      date: g.starts_at,
    }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

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
      area: { id: string; name: string } | null
    } | null
  }>
  type PlanEmbed = { code: string | null; name: string | null; duration_weeks: number | null; cost: number | null; requires_payment: boolean | null } | null
  const enrollments = (memberRow.study_enrollments ?? []) as Array<{
    id: string
    status: string
    completed_at: string | null
    enrolled_at: string | null
    grade: number | null
    notes: string | null
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
  // Estado de pago de matrícula por inscripción (para el botón "Pagar" del perfil).
  // payments tiene columnas nuevas fuera de los tipos generados → cliente laxo.
  const enrollmentIds = enrollments.map(e => e.id).filter(Boolean)
  const paymentStatusByEnrollment = new Map<string, string>()
  if (enrollmentIds.length) {
    const loose = supabase as unknown as SupabaseClient
    const { data: pays } = await loose
      .from('payments').select('enrollment_id, review_status, created_at')
      .in('enrollment_id', enrollmentIds).eq('concept', 'matricula')
      .order('created_at', { ascending: false })
    for (const p of (pays ?? []) as Array<{ enrollment_id: string | null; review_status: string | null }>) {
      if (p.enrollment_id && p.review_status && !paymentStatusByEnrollment.has(p.enrollment_id)) {
        paymentStatusByEnrollment.set(p.enrollment_id, p.review_status)
      }
    }
  }

  // Inscripciones a eventos con pago (para "Mis inscripciones a eventos" del perfil).
  // event_registrations/payments.event_registration_id son columnas nuevas fuera
  // de los tipos generados → cliente laxo (mismo patrón que paymentStatusByEnrollment).
  const looseEvents = supabase as unknown as SupabaseClient
  const { data: eventRegs } = await looseEvents
    .from('event_registrations')
    .select('id, event_id, payment_status, registered_at, events(title, starts_at, payment_amount, requires_payment)')
    .eq('member_id', id)
    .order('registered_at', { ascending: false })
  const eventRegRows = (eventRegs ?? []) as unknown as Array<{
    id: string; event_id: string; payment_status: string; registered_at: string
    events: { title: string; starts_at: string; payment_amount: number | null; requires_payment: boolean }
      | { title: string; starts_at: string; payment_amount: number | null; requires_payment: boolean }[] | null
  }>
  const eventRegistrationIds = eventRegRows.map(r => r.id)
  const reviewStatusByEventRegistration = new Map<string, string>()
  if (eventRegistrationIds.length) {
    const { data: evPays } = await looseEvents
      .from('payments').select('event_registration_id, review_status, created_at')
      .in('event_registration_id', eventRegistrationIds).eq('concept', 'evento')
      .order('created_at', { ascending: false })
    for (const p of (evPays ?? []) as Array<{ event_registration_id: string | null; review_status: string | null }>) {
      if (p.event_registration_id && p.review_status && !reviewStatusByEventRegistration.has(p.event_registration_id)) {
        reviewStatusByEventRegistration.set(p.event_registration_id, p.review_status)
      }
    }
  }
  const eventRegistrationHistory = eventRegRows.map(r => {
    const ev = Array.isArray(r.events) ? r.events[0] : r.events
    return {
      registration_id: r.id,
      event_id: r.event_id,
      event_name: ev?.title ?? '',
      event_date: ev?.starts_at ?? r.registered_at,
      requires_payment: !!ev?.requires_payment,
      cost: Number(ev?.payment_amount ?? 0),
      payment_status: r.payment_status as 'pending' | 'paid' | 'exempted' | 'expired',
      review_status: reviewStatusByEventRegistration.get(r.id) ?? null,
    }
  })

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
        enrollment_id: e.id,
        code: plan.code as string,
        name: plan.name ?? '',
        date: d ? d.slice(0, 10) : null,
        year: d ? Number(d.slice(0, 4)) : null,
        weeks: plan.duration_weeks ?? null,
        status: e.status,
        requires_payment: !!plan.requires_payment && Number(plan.cost ?? 0) > 0,
        payment_status: paymentStatusByEnrollment.get(e.id) ?? null,
        cost: Number(plan.cost ?? 0),
        // EST-8: nota numérica y resultado del cierre ('aprobado' | 'reprobado: motivo').
        grade: e.grade ?? null,
        notes: e.notes ?? null,
      }
    })
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')) // más reciente primero (igual que eventos y donaciones)
  const currentEnrollment = enrollments
    .find(e => e.status === 'enrolled' && e.study_groups?.plan?.name)
  const currentStudy = currentEnrollment?.study_groups?.plan?.name ?? null
  const currentStudyWeek = currentEnrollment?.study_groups?.current_week ?? null
  const sede = (memberRow.sede as { code: string; name: string } | null) ?? null
  const sedeCase = (memberRow.sede_case as 'activo' | 'inactivo' | null) ?? null
  const sedeLastCheckin = (memberRow.sede_last_checkin as string | null) ?? null

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

  // Área padre del comité: resuelta vía mapa (el embed parent no es fiable).
  const areaMap = await getAreaNameMap(supabase)
  const service_history: DbService[] = volunteers
    .filter(v => v.service_positions)
    .map(v => ({
      position: v.service_positions!.title,
      committee: v.service_positions!.area?.name ?? '',
      area: parentAreaName(areaMap, v.service_positions!.area?.id)
        || v.service_positions!.area?.name
        || '',
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

  // Asistencia activa (criterio único, solo CHARLAS). checkinsRes viene
  // ordenado desc por checked_in_at, así que el primero es el más reciente.
  const charlaCheckins = (checkinsRes.data ?? []).filter((c) => {
    const ev = (c as Record<string, unknown>).events as { event_type: string } | null
    return ev?.event_type === 'charla'
  }) as Array<{ checked_in_at: string | null }>
  const charlaMonths = Array.from(new Set(
    charlaCheckins.map(c => (c.checked_in_at ?? '').slice(0, 7)).filter(Boolean),
  ))
  const lastCharlaCheckin = charlaCheckins.find(c => c.checked_in_at)?.checked_in_at ?? null

  // REF-1: la sede ya NO se recalcula en vivo — se lee lo PERSISTIDO
  // (members.sede_id/sede_case/sede_last_checkin), que mantiene la única
  // implementación de producción en SQL: refresh_member_sede(member_id) en el
  // trigger de cada check-in + refresh_member_sedes() masiva del pg_cron
  // (6:45 UTC). Frescura: el flip activo→inactivo por puro paso del tiempo
  // (sin check-in nuevo) lo corrige el cron nocturno (≤24h de rezago).
  const attendance_sede: MemberSedeResult | null = sede && sedeCase && sedeLastCheckin
    ? { name: sede.name, case: sedeCase, lastCheckin: sedeLastCheckin }
    : null

  // Familia: dos queries — primero los family_unit_id del miembro, después
  // los OTROS miembros de esos units.
  const family: DbFamilyMember[] = await loadFamily(supabase, id)

  return {
    ...(memberRow as DbMember),
    sede,
    sede_case: sedeCase,
    sede_last_checkin: sedeLastCheckin,
    attendance_sede,
    roles: activeRoles,
    estado_dirigente: estadoDirigente,
    // Dirigente = registro en study_leaders (activo/inactivo), lideró grupos, o
    // está activo en el comité Dirigentes.
    is_dirigente: ((memberRow.study_leaders as unknown[] | null)?.length ?? 0) > 0
      || ledStudies.length > 0
      || esComiteDirigentes(activeVolunteer?.service_positions?.area?.name),
    is_server: volunteers.some(v => v.status === 'active'),
    current_study: currentStudy,
    current_study_week: currentStudyWeek,
    completed_studies: completedStudies,
    study_history: studyHistory,
    event_registration_history: eventRegistrationHistory,
    active_service: activeVolunteer && activeVolunteer.service_positions
      ? {
          position: activeVolunteer.service_positions.title,
          committee: activeVolunteer.service_positions.area?.name ?? '',
          area: parentAreaName(areaMap, activeVolunteer.service_positions.area?.id)
            || activeVolunteer.service_positions.area?.name
            || '',
          from: activeVolunteer.start_date,
        }
      : null,
    attendance,
    service_history,
    donations,
    form_responses,
    family,
    wallet_pass_id: (memberRow.wallet_pass_id as string | null) ?? null,
    attendance_months: charlaMonths,
    attendance_active: meetsAttendanceCriteria(charlaCheckins.map(c => c.checked_in_at ?? '')),
    last_charla_checkin: lastCharlaCheckin,
    led_groups: ledGroups,
    led_studies: ledStudies,
  }
}

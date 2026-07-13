import { createAdminClient, type TableName } from '@/lib/supabase/admin'
import { getEvents } from './events'
import { eventsInRange } from '@/lib/events/event-views'

type SB = ReturnType<typeof createAdminClient>

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Cuenta filas con filtros encadenados. */
async function count(
  supabase: SB,
  table: TableName,
  build: (q: any) => any = (q) => q,
): Promise<number> {
  // table es una unión de nombres de tabla; fijar un literal evita que TS expanda
  // toda la unión (instanciación excesiva). El valor real es el de `table` en runtime.
  const { count: c, error } = await build(
    supabase.from(table as 'members').select('*', { count: 'exact', head: true }),
  )
  if (error) throw error
  return c ?? 0
}

function startOfMonthISO(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export type DashboardStats = {
  members: { total: number; active: number; new_this_month: number; without_cedula: number; duplicates_suggested: number }
  studies: { active_groups: number; active_estudios: number; active_capacitaciones: number; students: number; open_registration: number; open_requests: number; closing_soon: number; without_leader: number }
  events: { today: number; upcoming_this_month: number; this_week: number; pending_payments: number; near_capacity: number }
  servers: { active: number; positions: number; committees: number; open_vacancies: number; pending_applications: number }
  finance: { donors_active: number; pending_refunds: number; income_this_month: number }
  communications: { sent_this_month: number; total_recipients: number; failed: number }
}

export async function getDashboardStats(now: Date = new Date()): Promise<DashboardStats> {
  const supabase = createAdminClient()
  const monthStart = startOfMonthISO(now)
  const monthStartDate = monthStart.slice(0, 10)
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)
  const todayStr = now.toISOString().slice(0, 10)
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString()

  // Planes de Niveles (N1–N4) → para separar grupos de "estudios" vs
  // "capacitaciones" (el resto). Si no hay, estudios = 0.
  const { data: nivelPlans } = await supabase
    .from('study_plans').select('id').in('code', ['N1', 'N2', 'N3', 'N4'])
  const nivelIds = (nivelPlans ?? []).map((p) => (p as { id: string }).id)

  const [
    membersTotal, membersActive, membersNew, membersNoCedula,
    activeGroups, activeEstudios, students, openReg, openRequests, closingSoon, withoutLeader,
    pendingPayments,
    serversActive, committees, openVacancies, pendingApps,
    donorsActive, pendingRefunds,
    sentThisMonth, failedComms,
  ] = await Promise.all([
    count(supabase, 'members'),
    count(supabase, 'members', (q) => q.eq('is_active', true)),
    count(supabase, 'members', (q) => q.gte('created_at', monthStart)),
    count(supabase, 'members', (q) => q.is('cedula', null)),

    count(supabase, 'study_groups', (q) => q.in('status', ['en_matricula', 'en_curso'])),
    // Estudios = grupos activos de Niveles (N1–N4); capacitaciones = el resto.
    count(supabase, 'study_groups', (q) =>
      nivelIds.length === 0 ? q.in('status', ['__none__'])
        : q.in('status', ['en_matricula', 'en_curso']).in('plan_id', nivelIds)),
    count(supabase, 'study_enrollments', (q) => q.eq('status', 'enrolled')),
    count(supabase, 'study_groups', (q) => q.in('status', ['en_matricula'])),
    count(supabase, 'study_requests', (q) => q.eq('status', 'open')),
    count(supabase, 'study_groups', (q) => q.not('ends_at', 'is', null).lte('ends_at', in30).gte('ends_at', todayStr)),
    count(supabase, 'study_groups', (q) => q.is('leader_id', null)),

    count(supabase, 'payments', (q) => q.eq('status', 'pending')),

    count(supabase, 'volunteers', (q) => q.eq('status', 'active')),
    count(supabase, 'areas', (q) => q.eq('area_type', 'committee').eq('is_active', true)),
    count(supabase, 'vacancies', (q) => q.eq('status', 'published')),
    count(supabase, 'applications', (q) => q.eq('status', 'pending')),

    count(supabase, 'members', (q) => q.eq('is_donor', true)),
    count(supabase, 'refunds', (q) => q.eq('status', 'pending')),

    count(supabase, 'message_broadcasts', (q) => q.eq('status', 'sent').gte('created_at', monthStart)),
    count(supabase, 'message_logs', (q) => q.in('status', ['failed', 'bounced']).gte('created_at', monthStart)),
  ])

  // Eventos: NO se cuentan crudo (las charlas de hoy son ocurrencias de eventos
  // recurrentes, no filas con la fecha de hoy). Se traen los ACTIVOS (recurrentes
  // + próximos) y se EXPANDE con la misma lógica del calendario/lista.
  // Paginado hasta agotar: PostgREST corta cada respuesta en ~1000 filas y un
  // pageSize gigante truncaría en silencio.
  let activeEvents: Awaited<ReturnType<typeof getEvents>>['events'] = []
  for (let page = 1; ; page++) {
    const batch = await getEvents({ light: true, is_active: true, page, pageSize: 1000 })
    activeEvents = activeEvents.concat(batch.events)
    if (activeEvents.length >= batch.total || batch.events.length < 1000) break
  }
  // Forma mínima para la expansión (eventsInRange usa start_at/end_at/recurrencia).
  const rangeable = activeEvents.map(e => ({
    id: e.id, start_at: e.starts_at, end_at: e.ends_at ?? e.starts_at,
    is_recurring: e.is_recurring, recurrence_rule: e.recurrence_rule, recurrence_end: e.recurrence_end,
  })) as unknown as Parameters<typeof eventsInRange>[0]
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const eventsToday = eventsInRange(rangeable, startToday, endToday).length
  const thisWeek = eventsInRange(rangeable, now, new Date(weekEnd)).length
  const upcomingMonth = eventsInRange(rangeable, now, monthEnd).length

  // Sumas y distinct agregados en SQL (RPC dashboard_sums, migración 040):
  // income del mes, destinatarios del mes y personas únicas sirviendo
  // (serversActive cuenta filas = puestos; una persona puede tener varios).
  let incomeThisMonth = 0
  let totalRecipients = 0
  let serversUnique = 0
  const { data: sums, error: sumsError } = await supabase
    .rpc('dashboard_sums', { p_month_start: monthStart, p_month_start_date: monthStartDate })
    .single()
  if (!sumsError && sums) {
    const s = sums as { income_this_month: number; total_recipients: number; servers_unique: number }
    incomeThisMonth = Number(s.income_this_month)
    totalRecipients = Number(s.total_recipients)
    serversUnique = Number(s.servers_unique)
  } else {
    // Fallback mientras la migración 040 no esté aplicada: traer y reducir en JS.
    console.warn('dashboard: rpc dashboard_sums no disponible, sumando en JS:', sumsError?.message)
    const [incomeRes, brRes, volRes] = await Promise.all([
      supabase.from('payments').select('amount').eq('status', 'paid').gte('payment_date', monthStartDate),
      supabase.from('message_broadcasts').select('total_recipients').gte('created_at', monthStart),
      supabase.from('volunteers').select('member_id').eq('status', 'active'),
    ])
    incomeThisMonth = (incomeRes.data ?? []).reduce((s, r) => s + Number((r as { amount: number }).amount), 0)
    totalRecipients = (brRes.data ?? []).reduce((s, r) => s + Number((r as { total_recipients: number }).total_recipients), 0)
    serversUnique = new Set((volRes.data ?? []).map(r => (r as { member_id: string }).member_id)).size
  }

  return {
    members: {
      total: membersTotal, active: membersActive, new_this_month: membersNew,
      without_cedula: membersNoCedula, duplicates_suggested: 0, // heurística, pendiente
    },
    studies: {
      active_groups: activeGroups,
      active_estudios: activeEstudios,
      active_capacitaciones: Math.max(0, activeGroups - activeEstudios),
      students, open_registration: openReg,
      open_requests: openRequests, closing_soon: closingSoon, without_leader: withoutLeader,
    },
    events: {
      today: eventsToday, upcoming_this_month: upcomingMonth, this_week: thisWeek,
      pending_payments: pendingPayments, near_capacity: 0, // heurística, pendiente
    },
    servers: {
      active: serversUnique, positions: serversActive, committees,
      open_vacancies: openVacancies, pending_applications: pendingApps,
    },
    finance: { donors_active: donorsActive, pending_refunds: pendingRefunds, income_this_month: incomeThisMonth },
    communications: { sent_this_month: sentThisMonth, total_recipients: totalRecipients, failed: failedComms },
  }
}

export type DbActivity = {
  id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  entity_type: string
  created_at: string
}

export async function getRecentActivity(limit = 10): Promise<DbActivity[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as DbActivity[]
}

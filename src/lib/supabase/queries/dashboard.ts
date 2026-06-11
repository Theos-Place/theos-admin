import { createAdminClient } from '@/lib/supabase/admin'

type SB = ReturnType<typeof createAdminClient>

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Cuenta filas con filtros encadenados. */
async function count(
  supabase: SB,
  table: string,
  build: (q: any) => any = (q) => q,
): Promise<number> {
  const { count: c, error } = await build(
    supabase.from(table).select('*', { count: 'exact', head: true }),
  )
  if (error) throw error
  return c ?? 0
}

function startOfMonthISO(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export type DashboardStats = {
  members: { total: number; active: number; new_this_month: number; without_cedula: number; duplicates_suggested: number }
  studies: { active_groups: number; students: number; open_registration: number; open_requests: number; closing_soon: number; without_leader: number }
  events: { upcoming_this_month: number; this_week: number; pending_payments: number; near_capacity: number }
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

  const [
    membersTotal, membersActive, membersNew, membersNoCedula,
    activeGroups, students, openReg, openRequests, closingSoon, withoutLeader,
    upcomingMonth, thisWeek, pendingPayments,
    serversActive, committees, openVacancies, pendingApps,
    donorsActive, pendingRefunds,
    sentThisMonth, failedComms,
  ] = await Promise.all([
    count(supabase, 'members'),
    count(supabase, 'members', (q) => q.eq('is_active', true)),
    count(supabase, 'members', (q) => q.gte('created_at', monthStart)),
    count(supabase, 'members', (q) => q.is('cedula', null)),

    count(supabase, 'study_groups', (q) => q.in('status', ['open', 'in_progress'])),
    count(supabase, 'study_enrollments', (q) => q.eq('status', 'enrolled')),
    count(supabase, 'study_groups', (q) => q.in('status', ['open', 'pending_opening'])),
    count(supabase, 'study_requests', (q) => q.eq('status', 'open')),
    count(supabase, 'study_groups', (q) => q.not('ends_at', 'is', null).lte('ends_at', in30).gte('ends_at', todayStr)),
    count(supabase, 'study_groups', (q) => q.is('leader_id', null)),

    count(supabase, 'events', (q) => q.eq('status', 'upcoming').gte('starts_at', monthStart)),
    count(supabase, 'events', (q) => q.gte('starts_at', now.toISOString()).lte('starts_at', weekEnd)),
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
      active_groups: activeGroups, students, open_registration: openReg,
      open_requests: openRequests, closing_soon: closingSoon, without_leader: withoutLeader,
    },
    events: {
      upcoming_this_month: upcomingMonth, this_week: thisWeek,
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

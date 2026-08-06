// Retroalimentación al dirigente contra la base. La REGLA es pura y vive en
// @/lib/studies/leader-feedback; acá solo se leen y escriben filas.
import { createAdminClient } from '@/lib/supabase/admin'
import { canEvaluate, summarize, type FeedbackSummary } from '@/lib/studies/leader-feedback'
import type { SupabaseClient } from '@supabase/supabase-js'

type GrupoRef = {
  id: string
  name: string | null
  status: string | null
  leader_id: string | null
  co_leader_id: string | null
  plan_name: string | null
  leader_name: string | null
}

/** Datos del grupo que necesita la evaluación (dirigente, estado, nombres). */
export async function feedbackGroupRef(groupId: string): Promise<GrupoRef | null> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { data } = await sb
    .from('study_groups')
    .select('id, name, status, leader_id, co_leader_id, plan:study_plans(name), leader:members!study_groups_leader_id_fkey(first_name, last_name)')
    .eq('id', groupId)
    .maybeSingle()
  if (!data) return null
  const g = data as unknown as {
    id: string; name: string | null; status: string | null
    leader_id: string | null; co_leader_id: string | null
    plan: { name: string | null } | null
    leader: { first_name: string; last_name: string } | null
  }
  return {
    id: g.id,
    name: g.name,
    status: g.status,
    leader_id: g.leader_id,
    co_leader_id: g.co_leader_id,
    plan_name: g.plan?.name ?? null,
    leader_name: g.leader ? `${g.leader.first_name} ${g.leader.last_name}`.trim() : null,
  }
}

/** ¿Puede esta persona evaluar este grupo? Resuelve las señales y delega la
 *  decisión en la regla pura. */
export async function memberCanEvaluate(groupId: string, memberId: string) {
  const sb = createAdminClient() as unknown as SupabaseClient
  const grupo = await feedbackGroupRef(groupId)
  if (!grupo) return { grupo: null, decision: { allowed: false as const, reason: 'Grupo no encontrado.' } }

  const [{ data: enr }, { data: yaResp }] = await Promise.all([
    sb.from('study_enrollments').select('status').eq('group_id', groupId).eq('member_id', memberId).maybeSingle(),
    sb.from('leader_evaluations').select('id').eq('group_id', groupId).eq('member_id', memberId).limit(1),
  ])

  return {
    grupo,
    decision: canEvaluate({
      enrollmentStatus: (enr as { status: string } | null)?.status ?? null,
      groupClosed: grupo.status === 'finalizado',
      alreadyAnswered: ((yaResp ?? []) as unknown[]).length > 0,
      isLeader: memberId === grupo.leader_id || memberId === grupo.co_leader_id,
    }),
  }
}

/** Guarda la evaluación. El `leader_id` de la tabla apunta a study_leaders, no a
 *  members: se resuelve desde el dirigente del grupo. */
export async function saveLeaderFeedback(input: {
  groupId: string
  memberId: string
  score: number
  comments: string | null
}): Promise<void> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const grupo = await feedbackGroupRef(input.groupId)
  if (!grupo?.leader_id) throw new Error('GRUPO_SIN_DIRIGENTE')

  const { data: sl } = await sb
    .from('study_leaders').select('id').eq('member_id', grupo.leader_id).limit(1).maybeSingle()
  const leaderId = (sl as { id: string } | null)?.id
  if (!leaderId) throw new Error('DIRIGENTE_SIN_FICHA')

  const { error } = await sb.from('leader_evaluations').insert({
    leader_id: leaderId,
    group_id: input.groupId,
    member_id: input.memberId,
    score: input.score,
    comments: input.comments,
    evaluation_date: new Date().toISOString().slice(0, 10),
  })
  // 23505 = el índice único: ya había respondido (carrera con doble clic).
  if (error && (error as { code?: string }).code !== '23505') throw error
}

/** Resumen de UN grupo. */
export async function groupFeedbackSummary(groupId: string): Promise<FeedbackSummary> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { data } = await sb.from('leader_evaluations').select('score, comments').eq('group_id', groupId)
  return summarize((data ?? []) as Array<{ score: number; comments: string | null }>)
}

/** Resumen acumulado de un DIRIGENTE (todos sus grupos). Es lo que sirve para
 *  ver una tendencia; una sola cohorte dice poco. */
export async function leaderFeedbackSummary(leaderMemberId: string): Promise<FeedbackSummary> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { data: sl } = await sb
    .from('study_leaders').select('id').eq('member_id', leaderMemberId).limit(1).maybeSingle()
  const leaderId = (sl as { id: string } | null)?.id
  if (!leaderId) return summarize([])
  const { data } = await sb.from('leader_evaluations').select('score, comments').eq('leader_id', leaderId)
  return summarize((data ?? []) as Array<{ score: number; comments: string | null }>)
}

import { createAdminClient } from '@/lib/supabase/admin'

export type StudyInvitation = {
  id: string
  member_id: string
  member_name: string
  plan_id: string
  plan_code: string
  plan_name: string
  invited_by: string | null
  invited_by_name: string | null
  status: 'active' | 'revoked' | 'used'
  notes: string | null
  created_at: string
}

type Embedded = {
  id: string
  member_id: string
  plan_id: string
  invited_by: string | null
  status: 'active' | 'revoked' | 'used'
  notes: string | null
  created_at: string
  member: { first_name: string; last_name: string } | null
  plan: { code: string | null; name: string } | null
  inviter: { first_name: string; last_name: string } | null
}

const fullName = (m: { first_name: string; last_name: string } | null) =>
  m ? `${m.first_name} ${m.last_name}`.trim() : ''

const SELECT = `
  id, member_id, plan_id, invited_by, status, notes, created_at,
  member:members!study_invitations_member_id_fkey(first_name, last_name),
  plan:study_plans!study_invitations_plan_id_fkey(code, name),
  inviter:members!study_invitations_invited_by_fkey(first_name, last_name)
`

function toDomain(r: Embedded): StudyInvitation {
  return {
    id: r.id,
    member_id: r.member_id,
    member_name: fullName(r.member),
    plan_id: r.plan_id,
    plan_code: r.plan?.code ?? '',
    plan_name: r.plan?.name ?? '',
    invited_by: r.invited_by,
    invited_by_name: fullName(r.inviter) || null,
    status: r.status,
    notes: r.notes,
    created_at: r.created_at,
  }
}

/** Invitaciones de un plan (todas, ordenadas: activas primero, recientes arriba). */
export async function listInvitationsForPlan(planId: string): Promise<StudyInvitation[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_invitations')
    .select(SELECT)
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as Embedded[]).map(toDomain)
    .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1))
}

/** Códigos de plan con invitación ACTIVA para un miembro (para elegibilidad/matrícula). */
export async function activeInvitationCodesForMember(memberId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_invitations')
    .select('plan:study_plans!study_invitations_plan_id_fkey(code)')
    .eq('member_id', memberId)
    .eq('status', 'active')
  if (error) throw error
  return ((data ?? []) as Array<{ plan: { code: string | null } | null }>)
    .map(r => r.plan?.code).filter((c): c is string => !!c)
}

/** Crea una invitación activa (idempotente: si ya hay una activa, la devuelve). */
export async function createInvitation(input: {
  member_id: string; plan_id: string; invited_by?: string | null; notes?: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('study_invitations').select('id')
    .eq('member_id', input.member_id).eq('plan_id', input.plan_id).eq('status', 'active').maybeSingle()
  if (existing) return existing as { id: string }
  const { data, error } = await supabase
    .from('study_invitations')
    .insert({ member_id: input.member_id, plan_id: input.plan_id, invited_by: input.invited_by ?? null, notes: input.notes ?? null })
    .select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Revoca una invitación (status = revoked). */
export async function revokeInvitation(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('study_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Marca como usada la invitación activa de (member, plan) — al matricularse. No falla si no hay. */
export async function markInvitationUsed(memberId: string, planId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('study_invitations')
    .update({ status: 'used', updated_at: new Date().toISOString() })
    .eq('member_id', memberId).eq('plan_id', planId).eq('status', 'active')
  if (error) throw error
}

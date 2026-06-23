import { createAdminClient } from '@/lib/supabase/admin'

// Excepciones de requisitos de matrícula (mismo patrón que study-invitations).
// Tabla study_requirement_exceptions (migración 072).

export type WaivableRequirement = 'donor' | 'attendance' | 'server' | 'prerequisite' | 'all'

export type StudyException = {
  id: string
  member_id: string
  member_name: string
  plan_id: string
  plan_code: string
  plan_name: string
  waived_requirements: string[]
  reason: string | null
  granted_by: string | null
  granted_by_name: string | null
  status: 'active' | 'revoked' | 'used'
  created_at: string
}

type Embedded = {
  id: string
  member_id: string
  plan_id: string
  waived_requirements: string[] | null
  reason: string | null
  granted_by: string | null
  status: 'active' | 'revoked' | 'used'
  created_at: string
  member: { first_name: string; last_name: string } | null
  plan: { code: string | null; name: string } | null
  granter: { first_name: string; last_name: string } | null
}

const fullName = (m: { first_name: string; last_name: string } | null) =>
  m ? `${m.first_name} ${m.last_name}`.trim() : ''

const SELECT = `
  id, member_id, plan_id, waived_requirements, reason, granted_by, status, created_at,
  member:members!study_requirement_exceptions_member_id_fkey(first_name, last_name),
  plan:study_plans!study_requirement_exceptions_plan_id_fkey(code, name),
  granter:members!study_requirement_exceptions_granted_by_fkey(first_name, last_name)
`

function toDomain(r: Embedded): StudyException {
  return {
    id: r.id,
    member_id: r.member_id,
    member_name: fullName(r.member),
    plan_id: r.plan_id,
    plan_code: r.plan?.code ?? '',
    plan_name: r.plan?.name ?? '',
    waived_requirements: r.waived_requirements ?? [],
    reason: r.reason,
    granted_by: r.granted_by,
    granted_by_name: fullName(r.granter) || null,
    status: r.status,
    created_at: r.created_at,
  }
}

/** Excepciones de un miembro (todas; activas primero, recientes arriba). */
export async function listExceptionsForMember(memberId: string): Promise<StudyException[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_requirement_exceptions')
    .select(SELECT).eq('member_id', memberId).order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Embedded[]).map(toDomain)
    .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1))
}

/** Excepciones ACTIVAS de un miembro como mapa code → requisitos perdonados.
 *  Para la elegibilidad de matrícula (computeEligibility trabaja por code). */
export async function activeExceptionsByCodeForMember(memberId: string): Promise<Record<string, string[]>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_requirement_exceptions')
    .select('waived_requirements, plan:study_plans!study_requirement_exceptions_plan_id_fkey(code)')
    .eq('member_id', memberId).eq('status', 'active')
  if (error) throw error
  const out: Record<string, string[]> = {}
  for (const r of (data ?? []) as Array<{ waived_requirements: string[] | null; plan: { code: string | null } | null }>) {
    const code = r.plan?.code
    if (code) out[code] = r.waived_requirements ?? []
  }
  return out
}

/** Excepciones ACTIVAS de un miembro como mapa plan_id → requisitos perdonados
 *  (para getEligibleStudiesForMember, que trabaja por plan_id). */
export async function activeExceptionsByPlanForMember(memberId: string): Promise<Map<string, string[]>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_requirement_exceptions')
    .select('plan_id, waived_requirements').eq('member_id', memberId).eq('status', 'active')
  if (error) throw error
  const m = new Map<string, string[]>()
  for (const r of (data ?? []) as Array<{ plan_id: string; waived_requirements: string[] | null }>) {
    m.set(r.plan_id, r.waived_requirements ?? [])
  }
  return m
}

/** Crea/actualiza la excepción activa de (member, plan). Idempotente por el UNIQUE. */
export async function createException(input: {
  member_id: string; plan_id: string; waived_requirements: string[]; reason?: string | null; granted_by?: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_requirement_exceptions')
    .upsert({
      member_id: input.member_id,
      plan_id: input.plan_id,
      waived_requirements: input.waived_requirements,
      reason: input.reason ?? null,
      granted_by: input.granted_by ?? null,
      status: 'active',
      revoked_at: null,
    }, { onConflict: 'member_id,plan_id' })
    .select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Revoca una excepción (status = revoked). */
export async function revokeException(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_requirement_exceptions')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Marca como usada la excepción activa de (member, plan) — al matricularse. No falla si no hay. */
export async function markExceptionUsed(memberId: string, planId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_requirement_exceptions')
    .update({ status: 'used' }).eq('member_id', memberId).eq('plan_id', planId).eq('status', 'active')
  if (error) throw error
}

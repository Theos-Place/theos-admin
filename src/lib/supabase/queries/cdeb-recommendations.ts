import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizeCdebRecommendation, type CdebRecommendationInput } from '@/lib/studies/cdeb-recommendation'

// EST-9: recomendaciones a CDEB por estudiante (cierre de DIS3 / Panorama).
// La tabla tiene RLS sin policies: SOLO service role. El gate de rol lo pone
// cada endpoint (CDEB_REC_VIEW_ROLES para leer; el dirigente del grupo escribe).
const loose = () => createAdminClient() as unknown as SupabaseClient

export type CdebRecommendationRow = CdebRecommendationInput & {
  id: string
  group_id: string
  status: 'borrador' | 'enviada'
  filled_by: string | null
  created_at: string
  updated_at: string
}

/** Guarda (upsert por member+group) una recomendación. `status` distingue el
 *  guardado parcial del envío — el cierre NO se bloquea por borradores. */
export async function saveCdebRecommendation(input: {
  memberId: string
  groupId: string
  enrollmentId?: string | null
  planCode: string | null
  filledBy: string | null
  status: 'borrador' | 'enviada'
  data: CdebRecommendationInput
}): Promise<{ id: string }> {
  const clean = sanitizeCdebRecommendation(input.data, input.planCode)
  const sb = loose()
  const { data, error } = await sb.from('cdeb_recommendations').upsert({
    member_id: input.memberId,
    group_id: input.groupId,
    enrollment_id: input.enrollmentId ?? null,
    filled_by: input.filledBy,
    status: input.status,
    completion_date: clean.completion_date,
    convictions: clean.convictions,
    testimony_score: clean.testimony_score,
    testimony_notes: clean.testimony_notes,
    passion_score: clean.passion_score,
    passion_notes: clean.passion_notes,
    bible_knowledge_score: clean.bible_knowledge_score,
    speech_score: clean.speech_score,
    speech_notes: clean.speech_notes,
    commitment_notes: clean.commitment_notes,
    committee_notes: clean.committee_notes,
    recommendation: clean.recommendation,
    recommended_prior_study: clean.recommended_prior_study,
  }, { onConflict: 'member_id,group_id' }).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Recomendaciones de un grupo (para retomar borradores desde el cierre). */
export async function getCdebRecommendationsByGroup(groupId: string): Promise<CdebRecommendationRow[]> {
  const sb = loose()
  const { data, error } = await sb.from('cdeb_recommendations').select('*').eq('group_id', groupId)
  if (error) throw error
  return (data ?? []) as CdebRecommendationRow[]
}

/** Recomendaciones de un miembro (panel del perfil, gate CDEB_REC_VIEW_ROLES).
 *  Solo las ENVIADAS: un borrador ajeno no es información del comité. */
export async function getCdebRecommendationsByMember(memberId: string): Promise<CdebRecommendationRow[]> {
  const sb = loose()
  const { data, error } = await sb.from('cdeb_recommendations')
    .select(`*, group:study_groups!cdeb_recommendations_group_id_fkey(name, plan:study_plans(code)),
             leader:members!cdeb_recommendations_filled_by_fkey(first_name, last_name)`)
    .eq('member_id', memberId).eq('status', 'enviada')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CdebRecommendationRow[]
}

/** Cola del comité de dirigentes: recomendaciones ENVIADAS, con el estudiante,
 *  el grupo y si ya tiene invitación activa a CDEB (para no invitar dos veces). */
export async function getCdebRecommendationQueue(): Promise<Array<Record<string, unknown>>> {
  const sb = loose()
  const { data, error } = await sb.from('cdeb_recommendations')
    .select(`*,
      member:members!cdeb_recommendations_member_id_fkey(id, first_name, last_name),
      group:study_groups!cdeb_recommendations_group_id_fkey(name, plan:study_plans(code)),
      leader:members!cdeb_recommendations_filled_by_fkey(first_name, last_name)`)
    .eq('status', 'enviada')
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as Array<Record<string, unknown>>

  // ¿Ya tiene invitación activa a CDEB? (EST-5: CDEB es invitation-only.)
  const memberIds = [...new Set(rows.map(r => (r.member_id as string)))]
  if (memberIds.length === 0) return rows
  const { data: plan } = await sb.from('study_plans').select('id').eq('code', 'CDEB').maybeSingle()
  const planId = (plan as { id: string } | null)?.id
  if (!planId) return rows.map(r => ({ ...r, has_cdeb_invitation: false }))
  const { data: invs } = await sb.from('study_invitations')
    .select('member_id').eq('plan_id', planId).eq('status', 'active').in('member_id', memberIds)
  const invited = new Set(((invs ?? []) as Array<{ member_id: string }>).map(i => i.member_id))
  return rows.map(r => ({ ...r, has_cdeb_invitation: invited.has(r.member_id as string) }))
}

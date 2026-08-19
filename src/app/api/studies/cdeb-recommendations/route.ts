import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validate'
import {
  allowsCdebRecommendation, validateCdebRecommendation, CDEB_REC_VIEW_ROLES,
  type CdebRecommendationInput,
} from '@/lib/studies/cdeb-recommendation'
import {
  saveCdebRecommendation, getCdebRecommendationsByGroup, getCdebRecommendationsByMember,
  getCdebRecommendationQueue,
} from '@/lib/supabase/queries/cdeb-recommendations'

// EST-9 · recomendaciones a CDEB (cierre de DIS3 / Panorama).
//
// GET  ?group_id=  → recomendaciones del grupo (para retomar borradores en el
//                    cierre): quien puede cerrar el grupo.
//      ?member_id= → ENVIADAS de una persona (panel del perfil): gate estrecho.
//      sin params  → cola del comité de dirigentes: gate estrecho.
// POST → guarda una recomendación (borrador o enviada). El dirigente del grupo
//        y los roles de estudios pueden escribir; un borrador NO se valida
//        (el cierre nunca se bloquea por un guardado parcial).

const bodySchema = z
  .object({
    group_id: z.uuid(),
    member_id: z.uuid(),
    enrollment_id: z.uuid().nullish(),
    status: z.enum(['borrador', 'enviada']),
    completion_date: z.string().trim().nullish(),
    convictions: z.array(z.object({
      topic: z.string(),
      stance: z.string(),
      notes: z.string().nullish(),
    })).default([]),
    testimony_score: z.string().nullish(),
    testimony_notes: z.string().nullish(),
    passion_score: z.string().nullish(),
    passion_notes: z.string().nullish(),
    bible_knowledge_score: z.string().nullish(),
    speech_score: z.string().nullish(),
    speech_notes: z.string().nullish(),
    commitment_notes: z.string().nullish(),
    committee_notes: z.string().nullish(),
    recommendation: z.string().nullish(),
    recommended_prior_study: z.string().nullish(),
  })
  .strict()

/** Plan + dirigentes del grupo (para el gate de escritura y la opción X de PAN). */
async function groupContext(groupId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('study_groups')
    .select('leader_id, co_leader_id, plan:study_plans(code)')
    .eq('id', groupId).maybeSingle()
  if (!data) return null
  const row = data as { leader_id: string | null; co_leader_id: string | null; plan: { code: string | null } | { code: string | null }[] | null }
  const planEmbed = Array.isArray(row.plan) ? row.plan[0] : row.plan
  return { leaderId: row.leader_id, coLeaderId: row.co_leader_id, planCode: planEmbed?.code ?? null }
}

export async function GET(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { searchParams } = req.nextUrl
    const groupId = searchParams.get('group_id')
    const memberId = searchParams.get('member_id')

    if (groupId) {
      if (!isUuid(groupId)) return NextResponse.json({ error: 'group_id inválido' }, { status: 400 })
      // Quien puede cerrar el grupo (coordinaciones/dirección) o su dirigente.
      const ctx = await groupContext(groupId)
      if (!ctx) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
      const isCloser = auth.ctx.roles.some(r => ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin'].includes(r))
      const isLeader = !!auth.ctx.memberId && (ctx.leaderId === auth.ctx.memberId || ctx.coLeaderId === auth.ctx.memberId)
      if (!isCloser && !isLeader) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      return NextResponse.json({ items: await getCdebRecommendationsByGroup(groupId) })
    }

    // Perfil y cola: SENSIBLE — solo el comité de dirigentes / coord. estudios / admin.
    const canView = auth.ctx.roles.some(r => (CDEB_REC_VIEW_ROLES as string[]).includes(r))
    if (!canView) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    if (memberId) {
      if (!isUuid(memberId)) return NextResponse.json({ error: 'member_id inválido' }, { status: 400 })
      return NextResponse.json({ items: await getCdebRecommendationsByMember(memberId) })
    }
    return NextResponse.json({ items: await getCdebRecommendationQueue() })
  } catch (error) {
    console.error('GET /api/studies/cdeb-recommendations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const body = parsed.data
    const ctx = await groupContext(body.group_id)
    if (!ctx) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })

    // Solo grupos DIS3 / Panorama tienen este cierre especial.
    if (!allowsCdebRecommendation(ctx.planCode)) {
      return NextResponse.json({ error: 'Este grupo no lleva recomendación a CDEB.', code: 'plan_no_aplica' }, { status: 400 })
    }
    // Escribe el dirigente del grupo o quien cierra grupos.
    const isCloser = auth.ctx.roles.some(r => ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin'].includes(r))
    const isLeader = !!auth.ctx.memberId && (ctx.leaderId === auth.ctx.memberId || ctx.coLeaderId === auth.ctx.memberId)
    if (!isCloser && !isLeader) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const data: CdebRecommendationInput = { ...body, member_id: body.member_id }
    // El BORRADOR no se valida (guardado parcial); el ENVÍO sí.
    if (body.status === 'enviada') {
      const err = validateCdebRecommendation(data, ctx.planCode)
      if (err) return NextResponse.json({ error: err, code: 'recomendacion_incompleta' }, { status: 400 })
    }

    const saved = await saveCdebRecommendation({
      memberId: body.member_id,
      groupId: body.group_id,
      enrollmentId: body.enrollment_id ?? null,
      planCode: ctx.planCode,
      filledBy: auth.ctx.memberId,
      status: body.status,
      data,
    })
    return NextResponse.json({ ok: true, id: saved.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/cdeb-recommendations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

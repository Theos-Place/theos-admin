import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'
import { puedeCerrarEsteGrupo } from '@/lib/studies/quien-cierra'
import { esGrupoSCJ } from '@/lib/servers/invitacion-perfil-sirve'

/**
 * SRV-20 (etapa 4, parte A) · La invitación a llenar el perfil S.I.R.V.E.
 * desde un grupo de Sirviendo como Jesús.
 *
 * GET  → el estado: cuántos matriculados, invitados, cuántos llenaron, y qué
 *        ofrece el botón (enviar / reenviar / nada).
 * POST → manda el correo. `{ action: 'enviar' | 'reenviar' }`.
 *
 * Quién: la MISMA regla que cerrar el grupo (`puedeCerrarEsteGrupo`):
 * coordinación de estudios por rol, o el dirigente / co-dirigente de ESTE
 * grupo. Solo en grupos de SCJ: en otro plan el botón no existe y el POST
 * dice por qué.
 */
async function autorizar(id: string) {
  // Solo sesión: el dirigente o co-dirigente de ESTE grupo, o la coordinación por rol (puedeCerrarEsteGrupo).
  const auth = await requireRoles()
  if (auth.res) return { res: auth.res }
  if (!isUuid(id)) return { res: NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 }) }
  // El plan del grupo vive en study_plans vía plan_id: `study_type_id` es
  // un campo DERIVADO del adapter (plan.code), no una columna.
  const { data: g } = await createAdminClient()
    .from('study_groups').select('leader_id, co_leader_id, plan:study_plans!study_groups_plan_id_fkey(code)').eq('id', id).maybeSingle()
  const crudo = g as { leader_id: string | null; co_leader_id: string | null; plan: { code: string | null } | { code: string | null }[] | null } | null
  if (!crudo) return { res: NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 }) }
  const grupo = { leader_id: crudo.leader_id, co_leader_id: crudo.co_leader_id }
  const plan = Array.isArray(crudo.plan) ? crudo.plan[0] : crudo.plan
  if (!puedeCerrarEsteGrupo({ roles: auth.ctx.roles, memberId: auth.ctx.memberId, grupo })) {
    return { res: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  if (!esGrupoSCJ(plan?.code)) {
    return { res: NextResponse.json({ error: 'La invitación al perfil S.I.R.V.E. es solo para grupos de Sirviendo como Jesús.', code: 'no_es_scj' }, { status: 409 }) }
  }
  return { ctx: auth.ctx }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizar(id)
  if (a.res) return a.res
  try {
    const { estadoDeInvitaciones } = await import('@/lib/email/sirve-invite-notify')
    return NextResponse.json(await estadoDeInvitaciones(id))
  } catch (error) {
    reportarError('GET /api/studies/groups/[id]/sirve-invite:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const bodySchema = z.object({ action: z.enum(['enviar', 'reenviar']) }).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizar(id)
  if (a.res) return a.res
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const { enviarInvitacionSirve } = await import('@/lib/email/sirve-invite-notify')
    const r = await enviarInvitacionSirve({ groupId: id, reenviar: parsed.data.action === 'reenviar', actorUserId: a.ctx.userId })
    if (r.error) return NextResponse.json({ error: r.error }, { status: 409 })
    await logAudit({ actorUserId: a.ctx.userId, action: 'UPDATE', entityType: 'study_groups', entityId: id,
      newData: { op: 'sirve_invitacion', action: parsed.data.action, sent: r.sent, omitidos: r.omitidos } })
    return NextResponse.json({ ok: true, sent: r.sent, omitidos: r.omitidos })
  } catch (error) {
    reportarError('POST /api/studies/groups/[id]/sirve-invite:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

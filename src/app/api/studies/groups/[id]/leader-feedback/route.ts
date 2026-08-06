import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { feedbackError, visibleForLeader, SCORE_MIN, SCORE_MAX, COMMENT_MAX } from '@/lib/studies/leader-feedback'
import {
  memberCanEvaluate, saveLeaderFeedback, groupFeedbackSummary, feedbackGroupRef,
} from '@/lib/supabase/queries/leader-feedback'

// Retroalimentación al dirigente de un grupo cerrado.
//
// GET  · ¿puedo responder? (el estudiante) o el resumen (staff y el dirigente).
// POST · guarda la respuesta del estudiante.

const bodySchema = z.object({
  score: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
  comments: z.string().max(COMMENT_MAX).nullish(),
}).strict()

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })

    const grupo = await feedbackGroupRef(id)
    if (!grupo) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })

    const memberId = auth.ctx.memberId
    const esStaff = auth.ctx.roles.some(r => (STUDY_ADMIN_ROLES as readonly string[]).includes(r))
    const esDirigente = !!memberId && (memberId === grupo.leader_id || memberId === grupo.co_leader_id)

    // El staff ve el resumen completo; el dirigente, el resumen protegido (sin
    // detalle mientras haya pocas respuestas, porque delataría a quien escribió).
    if (esStaff || esDirigente) {
      const resumen = await groupFeedbackSummary(id)
      return NextResponse.json({
        group: { id: grupo.id, name: grupo.name, plan_name: grupo.plan_name, leader_name: grupo.leader_name },
        summary: esStaff ? resumen : visibleForLeader(resumen),
      })
    }

    // Estudiante: si puede responder y el contexto para la pantalla.
    if (!memberId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const { decision } = await memberCanEvaluate(id, memberId)
    return NextResponse.json({
      group: { id: grupo.id, name: grupo.name, plan_name: grupo.plan_name, leader_name: grupo.leader_name },
      can_answer: decision.allowed,
      reason: decision.allowed ? null : decision.reason,
    })
  } catch (error) {
    console.error('GET /api/studies/groups/[id]/leader-feedback:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    const memberId = auth.ctx.memberId
    if (!memberId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    // Misma regla que la UI, por si el body viene de otro lado.
    const invalido = feedbackError(parsed.data)
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

    const { decision } = await memberCanEvaluate(id, memberId)
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason, code: 'no_puede_evaluar' }, { status: 403 })
    }

    await saveLeaderFeedback({
      groupId: id,
      memberId,
      score: parsed.data.score,
      comments: (parsed.data.comments ?? '').trim() || null,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'GRUPO_SIN_DIRIGENTE') {
      return NextResponse.json({ error: 'Este grupo no tiene dirigente asignado.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'DIRIGENTE_SIN_FICHA') {
      return NextResponse.json({ error: 'El dirigente de este grupo no tiene ficha de dirigente.' }, { status: 409 })
    }
    console.error('POST /api/studies/groups/[id]/leader-feedback:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

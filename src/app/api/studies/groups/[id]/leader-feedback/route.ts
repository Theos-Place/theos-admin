import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { feedbackError, leaderView, SCORE_MIN, SCORE_MAX, COMMENT_MAX } from '@/lib/studies/leader-feedback'
import { summarize } from '@/lib/studies/leader-feedback'
import { sendLeaderFeedbackReport } from '@/lib/email/leader-feedback-report-send'
import {
  memberCanEvaluate, saveLeaderFeedback, groupFeedbackRows, feedbackGroupRef,
  releaseGroupFeedback, setFeedbackHidden, surveyQuestions, saveSurveyResponse,
  groupPerQuestion,
} from '@/lib/supabase/queries/leader-feedback'

// Retroalimentación al dirigente de un grupo cerrado.
//
// GET  · ¿puedo responder? (el estudiante) o el resumen (staff y el dirigente).
// POST · guarda la respuesta del estudiante.

// Dos formas de responder:
//  · answers  → el CUESTIONARIO completo (EST-12): { <field_id>: "opción" }
//  · score    → la nota suelta, que es como nació esto y sigue sirviendo para
//               cargar una evaluación a mano.
const bodySchema = z.union([
  z.object({ answers: z.record(z.string().uuid(), z.string().max(COMMENT_MAX)) }).strict(),
  z.object({
    score: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
    comments: z.string().max(COMMENT_MAX).nullish(),
  }).strict(),
])

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
      const filas = await groupFeedbackRows(id)
      const grupoInfo = { id: grupo.id, name: grupo.name, plan_name: grupo.plan_name, leader_name: grupo.leader_name }
      const porPregunta = await groupPerQuestion(id)
      if (esStaff) {
        // La coordinación ve TODO —incluidos los comentarios ya ocultados— y el
        // estado de la revisión, que es lo que le permite decidir.
        return NextResponse.json({
          group: grupoInfo,
          role: 'staff',
          released_at: grupo.feedback_released_at,
          summary: summarize(filas),
          per_question: porPregunta,
          rows: filas,
        })
      }
      // El dirigente: nada hasta que la coordinación lo comparta.
      return NextResponse.json({
        group: grupoInfo,
        role: 'leader',
        view: leaderView({
          released: !!grupo.feedback_released_at,
          summary: summarize(filas, { forLeader: true }),
        }),
        // El detalle por pregunta solo si ya se compartió.
        per_question: grupo.feedback_released_at ? porPregunta : [],
      })
    }

    // Estudiante: si puede responder y el contexto para la pantalla.
    if (!memberId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const { decision } = await memberCanEvaluate(id, memberId)
    // Las preguntas salen del formulario fijado al grupo: el cuestionario se
    // edita en el builder, no en el código.
    const cuestionario = decision.allowed ? await surveyQuestions(id) : { formId: null, fields: [] }
    return NextResponse.json({
      group: { id: grupo.id, name: grupo.name, plan_name: grupo.plan_name, leader_name: grupo.leader_name },
      can_answer: decision.allowed,
      reason: decision.allowed ? null : decision.reason,
      form_id: cuestionario.formId,
      fields: cuestionario.fields,
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
    const { decision } = await memberCanEvaluate(id, memberId)
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason, code: 'no_puede_evaluar' }, { status: 403 })
    }

    const cuerpo = parsed.data
    if ('answers' in cuerpo) {
      const respuestas = cuerpo.answers
      const { formId, fields } = await surveyQuestions(id)
      if (!formId) return NextResponse.json({ error: 'No hay cuestionario configurado.' }, { status: 409 })
      // Las obligatorias tienen que venir: el guard de la UI no alcanza.
      const faltan = fields.filter(f => f.is_required && !(respuestas[f.id] ?? '').trim())
      if (faltan.length > 0) {
        return NextResponse.json(
          { error: `Falta responder: ${faltan[0].label}`, code: 'faltan_respuestas' },
          { status: 400 },
        )
      }
      await saveSurveyResponse({ groupId: id, memberId, formId, answers: respuestas })
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    // Misma regla que la UI, por si el body viene de otro lado.
    const invalido = feedbackError(cuerpo)
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })
    await saveLeaderFeedback({
      groupId: id,
      memberId,
      score: cuerpo.score,
      comments: (cuerpo.comments ?? '').trim() || null,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'YA_RESPONDIO') {
      return NextResponse.json({ error: 'Ya enviaste tu evaluación de este grupo. ¡Gracias!', code: 'ya_respondio' }, { status: 409 })
    }
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

// PATCH · acciones de REVISIÓN, solo para la coordinación de estudios.
//   { action: 'ocultar',  evaluation_id, reason? } — el dirigente no lo ve
//   { action: 'mostrar',  evaluation_id }
//   { action: 'compartir' }                        — recién ahí el dirigente ve
const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ocultar'), evaluation_id: z.string().uuid(), reason: z.string().max(300).nullish() }),
  z.object({ action: z.literal('mostrar'), evaluation_id: z.string().uuid() }),
  z.object({ action: z.literal('compartir') }),
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Revisar es de la coordinación de estudios: el dirigente no modera su
    // propia retroalimentación.
    const auth = await requireRoles(...STUDY_ADMIN_ROLES)
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })

    const parsed = patchSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    if (parsed.data.action === 'compartir') {
      await releaseGroupFeedback(id, auth.ctx.memberId)
      // EST-13: compartir ES enviar. El paso de revisión que pedía el plan ya
      // ocurrió — el comité leyó las respuestas y ocultó lo que no correspondía
      // antes de apretar este botón. Best-effort: si el correo falla, la
      // retroalimentación igual queda compartida en la ficha.
      let sent = 0
      try {
        sent = (await sendLeaderFeedbackReport(id)).sent
      } catch (e) {
        console.warn('No se pudo enviar el resumen al dirigente:', e)
      }
      return NextResponse.json({ ok: true, sent })
    }
    await setFeedbackHidden({
      evaluationId: parsed.data.evaluation_id,
      groupId: id,
      hidden: parsed.data.action === 'ocultar',
      reason: parsed.data.action === 'ocultar' ? parsed.data.reason ?? null : null,
      actorMemberId: auth.ctx.memberId,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/studies/groups/[id]/leader-feedback:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

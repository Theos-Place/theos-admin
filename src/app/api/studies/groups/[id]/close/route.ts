import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { scheduleLeaderFeedback } from '@/lib/email/leader-feedback-notify'
import { closeGroup, type CloseResult } from '@/lib/supabase/queries/studies'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowsCloseRecommendations } from '@/lib/studies/close-recommendations'
import { autoEnrollApprovedToNextLevel } from '@/lib/supabase/queries/payments'
import { PREMAT_PLAN_CODE, getRequestsForGroup, savePrematEvaluations } from '@/lib/supabase/queries/prematrimonial'
import { validatePrematEvaluation, type PrematEvaluationInput } from '@/lib/studies/premat-evaluation'

// POST: cierra el grupo. Body: { results: CloseResult[] }. (FOL-1: el campo
// folleto del body viejo se ignora — el cierre ya no genera folletos.)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
  if (auth.res) return auth.res
  // Body y params fuera del try: el catch de YA_CERRADO los necesita para reconciliar.
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { results?: CloseResult[]; evaluations?: PrematEvaluationInput[] }
  const results = body.results ?? []
  try {
    const supabase = createAdminClient()
    const { data: g } = await supabase
      .from('study_groups').select('plan:study_plans(code)').eq('id', id).maybeSingle()
    const planEmbed = (g as { plan: { code: string | null } | { code: string | null }[] | null } | null)?.plan
    const sourceCode = (Array.isArray(planEmbed) ? planEmbed[0] : planEmbed)?.code ?? null

    // PRE-8: los grupos PREMAT exigen la evaluación de CADA pareja del grupo
    // antes de cerrar (una por prematrimonial_request). Se guarda ANTES del
    // cierre: si el cierre falla, la evaluación queda (upsert por pareja) y el
    // retry no la duplica ni la pierde.
    if (sourceCode === PREMAT_PLAN_CODE) {
      const parejas = await getRequestsForGroup(id)
      const evaluations = body.evaluations ?? []
      const byRequest = new Map(evaluations.map(e => [e.request_id, e]))
      const faltantes = parejas.filter(p => !byRequest.has(p.id))
      if (faltantes.length > 0) {
        return NextResponse.json(
          { error: `Falta la evaluación de ${faltantes.length} pareja(s) del grupo.`, code: 'evaluacion_requerida' },
          { status: 400 },
        )
      }
      // Solo las parejas de ESTE grupo (ignora request_id ajenos).
      const validIds = new Set(parejas.map(p => p.id))
      const propias = evaluations.filter(e => validIds.has(e.request_id))
      for (const e of propias) {
        const err = validatePrematEvaluation(e)
        if (err) return NextResponse.json({ error: err, code: 'evaluacion_invalida' }, { status: 400 })
      }
      await savePrematEvaluations(id, propias, auth.ctx.memberId)
    }

    // El motivo es obligatorio: justificación al reprobar y motivo al retirar
    // (2026-08-04). Defensa server-side del mismo chequeo de la pantalla — un
    // retiro sin motivo deja al estudiante fuera del grupo sin rastro de por qué.
    const sinMotivo = (results ?? []).filter(r =>
      (r.status_result === 'reprobado' && !(r.fail_reason ?? '').trim())
      || (r.status_result === 'retirado' && !(r.withdraw_reason ?? '').trim()))
    if (sinMotivo.length > 0) {
      const { data: quienes } = await supabase
        .from('members').select('id, first_name, last_name')
        .in('id', sinMotivo.map(r => r.member_id))
      const nombre = new Map(((quienes ?? []) as Array<{ id: string; first_name: string; last_name: string }>)
        .map(m => [m.id, `${m.first_name} ${m.last_name}`.trim()]))
      const detalle = sinMotivo.map(r => `${nombre.get(r.member_id) ?? 'un estudiante'} (${
        r.status_result === 'reprobado' ? 'falta la justificación de la reprobación' : 'falta el motivo del retiro'
      })`).join('; ')
      return NextResponse.json(
        { error: `No se puede cerrar: ${detalle}.`, code: 'motivo_requerido' },
        { status: 400 },
      )
    }

    // EST-3: recomendaciones solo en N4+ o capacitaciones (DIS). Si el cliente
    // las manda para otro plan, se ignoran (el gate de la UI es solo UX).
    const sanitized = allowsCloseRecommendations(sourceCode)
      ? (results ?? [])
      : (results ?? []).map(r => ({ ...r, recommendations: null }))

    await closeGroup(id, sanitized, auth.ctx.memberId)

    // Matrícula automática al siguiente nivel para los aprobados, en estado
    // 'pendiente_de_pago' + pago pendiente (concepto matricula). Best-effort.
    let autoEnrolled = 0
    try {
      const approvedIds = (results ?? []).filter(r => r.status_result === 'aprobado').map(r => r.member_id)
      const { enrolled } = await autoEnrollApprovedToNextLevel(id, approvedIds)
      autoEnrolled = enrolled
    } catch (e) {
      console.warn('No se pudo matricular automáticamente al siguiente nivel:', e)
    }

    // FOL-1: el cierre YA NO genera folletos — las reglas nuevas son cupo
    // lleno / fin de matrícula (durante la matrícula, no al cerrar) + manual.

    // EST-12: la encuesta al dirigente se PROGRAMA (por defecto el día
    // siguiente) y la despacha el cron study-surveys. Best-effort: el cierre no
    // se cae si esto falla.
    let surveyAt: string | null = null
    try {
      surveyAt = (await scheduleLeaderFeedback(id)).scheduled
    } catch (e) {
      console.warn('No se pudo programar la encuesta del dirigente:', e)
    }

    return NextResponse.json({ ok: true, autoEnrolled, surveyAt })
  } catch (error) {
    if (error instanceof Error && error.message === 'YA_CERRADO') {
      // A9 (reconciliación): si el cierre original murió DESPUÉS de finalizar
      // el grupo pero ANTES de completar la matrícula automática, los
      // aprobados quedaban sin matrícula y el retry solo rebotaba. Re-correr
      // la auto-matrícula acá es seguro: es idempotente (dedup por plan) y
      // repara a los que faltaron.
      let reconciled = 0
      try {
        const approvedIds = (results ?? []).filter(r => r.status_result === 'aprobado').map(r => r.member_id)
        if (approvedIds.length > 0) {
          const { enrolled } = await autoEnrollApprovedToNextLevel(id, approvedIds)
          reconciled = enrolled
        }
      } catch (e) {
        console.warn('Reconciliación de auto-matrícula tras YA_CERRADO:', e)
      }
      return NextResponse.json(
        {
          error: reconciled > 0
            ? `Este grupo ya estaba cerrado; se completó la matrícula automática de ${reconciled} aprobado(s) que faltaba(n).`
            : 'Este grupo ya fue cerrado. Refrescá la página para ver su estado.',
        },
        { status: 409 },
      )
    }
    console.error('POST /api/studies/groups/[id]/close:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

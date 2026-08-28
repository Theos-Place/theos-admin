import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { scheduleLeaderFeedback } from '@/lib/email/leader-feedback-notify'
import { closeGroup, type CloseResult } from '@/lib/supabase/queries/studies'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowsCloseRecommendations } from '@/lib/studies/close-recommendations'
import { autoEnrollApprovedToNextLevel } from '@/lib/supabase/queries/payments'
import { PREMAT_PLAN_CODE, getRequestsForGroup, savePrematEvaluations } from '@/lib/supabase/queries/prematrimonial'
import { isFolletoEligible, OTRO_LUGAR } from '@/lib/studies/folletos'
import { validatePrematEvaluation, type PrematEvaluationInput } from '@/lib/studies/premat-evaluation'

// POST: cierra el grupo. Body: { results: CloseResult[] }. (FOL-1: el campo
// folleto del body viejo se ignora — el cierre ya no genera folletos.)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Cierra quien gestiona grupos O el dirigente/co-dirigente DE ESTE grupo
  // (2026-08-20: el cierre es parte del trabajo del dirigente — el flujo de
  // recomendaciones a CDEB ya lo anticipaba así).
  const auth = await requireRoles()
  if (auth.res) return auth.res
  // Body y params fuera del try: el catch de YA_CERRADO los necesita para reconciliar.
  const { id } = await params
  {
    const closerRoles = ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin']
    const isCloser = auth.ctx.roles.some(r => closerRoles.includes(r))
    if (!isCloser) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const { data: g } = await createAdminClient()
        .from('study_groups').select('leader_id, co_leader_id').eq('id', id).maybeSingle()
      const row = g as { leader_id: string | null; co_leader_id: string | null } | null
      const isLeader = !!auth.ctx.memberId && !!row
        && (row.leader_id === auth.ctx.memberId || row.co_leader_id === auth.ctx.memberId)
      if (!isLeader) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }
  const body = (await req.json().catch(() => ({}))) as {
    results?: CloseResult[]
    evaluations?: PrematEvaluationInput[]
    /** Lugar de entrega de los folletos del grupo sucesor, dicho por quien cierra. */
    folletos_sede?: string
  }
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

    /**
     * El lugar de entrega es OBLIGATORIO cuando el cierre va a pedir folletos.
     *
     * Se valida acá arriba, antes de closeGroup, y no cuando se crea el
     * tiquete: el cierre es irreversible y la creación del folleto es
     * best-effort al final, así que para ese momento ya no hay forma de pedir
     * el dato. Un tiquete sin destino no se puede repartir y nadie se entera
     * hasta que llega a imprenta.
     */
    const aprobados = (results ?? []).filter(r => r.status_result === 'aprobado').length
    const pideFolletos = isFolletoEligible(sourceCode) && aprobados > 0
    const lugarEntrega = (body.folletos_sede ?? '').trim()
    if (pideFolletos && (!lugarEntrega || lugarEntrega === OTRO_LUGAR)) {
      return NextResponse.json(
        { error: 'Falta decir dónde se entregan los folletos.', code: 'lugar_entrega_requerido' },
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
    let successorGroupId: string | null = null
    try {
      const approvedIds = (results ?? []).filter(r => r.status_result === 'aprobado').map(r => r.member_id)
      const { enrolled, next_group_id } = await autoEnrollApprovedToNextLevel(id, approvedIds)
      autoEnrolled = enrolled
      successorGroupId = next_group_id
    } catch (e) {
      console.warn('No se pudo matricular automáticamente al siguiente nivel:', e)
    }

    /**
     * FOLLETOS DEL GRUPO SUCESOR (2026-08-27).
     *
     * FOL-1 había quitado la generación por cierre y la dejó en dos reglas que
     * corren DURANTE la matrícula: cupo lleno y fin de la ventana. Pero el grupo
     * que crea la auto-matrícula nace SIN cupo y SIN ventana, así que ninguna de
     * las dos puede dispararse nunca para él: quien aprueba N3 pasa a N4 y ese
     * N4 se queda sin folletos para siempre. Verificado en producción: había 0
     * tiquetes de folleto en TODA la base.
     *
     * El tiquete se pide para el grupo SUCESOR, no para el que se cerró: los
     * folletos son del estudio que la gente va a cursar, no del que terminó.
     *
     * Idempotente por el índice único parcial (una fila automática por grupo):
     * si después ese mismo grupo llena el cupo, no se duplica.
     */
    let folletoCreado = false
    if (successorGroupId) {
      try {
        const { createAutoFolletoIfNeeded, linkPaymentsToFolletoRequest } = await import('@/lib/supabase/queries/folletos')
        const { ymdCR } = await import('@/lib/format')
        const r = await createAutoFolletoIfNeeded(successorGroupId, 'cierre', ymdCR(), lugarEntrega)
        folletoCreado = r.created
        if (!r.created) console.warn('folleto de cierre no creado:', r.reason)
        // Los pagos individuales que acaba de crear la auto-matrícula quedan
        // colgados del tiquete. Va después de crear el tiquete porque hasta
        // acá no existe, y se hace también cuando el tiquete YA existía: el
        // cierre se reintenta y el enlace tiene que ser idempotente.
        if (r.id) {
          const { linked } = await linkPaymentsToFolletoRequest(successorGroupId, r.id)
          if (linked > 0) console.info(`folletos: ${linked} pago(s) enlazados al tiquete ${r.id}`)
        }
      } catch (e) {
        console.warn('No se pudo crear el tiquete de folletos del grupo sucesor:', e)
      }
    }

    // EST-12: la encuesta al dirigente se PROGRAMA (por defecto el día
    // siguiente) y la despacha el cron study-surveys. Best-effort: el cierre no
    // se cae si esto falla.
    let surveyAt: string | null = null
    try {
      surveyAt = (await scheduleLeaderFeedback(id)).scheduled
    } catch (e) {
      console.warn('No se pudo programar la encuesta del dirigente:', e)
    }

    return NextResponse.json({ ok: true, autoEnrolled, surveyAt, folletoCreado, successorGroupId })
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

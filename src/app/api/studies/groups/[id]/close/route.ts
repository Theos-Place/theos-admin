import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { closeGroup, type CloseResult } from '@/lib/supabase/queries/studies'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createFolletoRequest, getLeaderSedeForGroup, notifyFolletoRecipients,
} from '@/lib/supabase/queries/folletos'
import { isFolletoEligible, nextLevelCode, levelLabel, estimatedAvailableDate } from '@/lib/studies/folletos'
import { allowsCloseRecommendations } from '@/lib/studies/close-recommendations'
import { autoEnrollApprovedToNextLevel } from '@/lib/supabase/queries/payments'

type FolletoPayload = { send?: boolean; sede?: string }

// Fecha de hoy en zona Costa Rica (YYYY-MM-DD).
function costaRicaDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())
}

// POST: cierra el grupo. Body: { results: CloseResult[], folleto?: { send, sede } }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
  if (auth.res) return auth.res
  // Body y params fuera del try: el catch de YA_CERRADO los necesita para reconciliar.
  const { id } = await params
  const { results, folleto } = (await req.json().catch(() => ({ results: [] }))) as { results: CloseResult[]; folleto?: FolletoPayload }
  try {
    const supabase = createAdminClient()
    const { data: g } = await supabase
      .from('study_groups').select('plan:study_plans(code)').eq('id', id).maybeSingle()
    const planEmbed = (g as { plan: { code: string | null } | { code: string | null }[] | null } | null)?.plan
    const sourceCode = (Array.isArray(planEmbed) ? planEmbed[0] : planEmbed)?.code ?? null

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

    // Paso de folletos: al confirmar con envío activado, crear la solicitud del
    // siguiente nivel + notificar + correo. Best-effort: el cierre ya ocurrió,
    // así que un fallo acá NO revierte el cierre (solo se loguea).
    let folletoCreated = false
    if (folleto?.send) {
      try {
        const quantity = (results ?? []).filter(r => r.status_result === 'aprobado').length
        const target = nextLevelCode(sourceCode)

        if (quantity > 0 && isFolletoEligible(sourceCode) && target) {
          const closeDate = costaRicaDate()
          const availableAt = estimatedAvailableDate(closeDate)
          const sede = (folleto.sede ?? '').trim() || (await getLeaderSedeForGroup(id))

          await createFolletoRequest({
            source_group_id: id,
            source_plan_code: sourceCode!,
            target_level_code: target,
            quantity,
            sede,
            close_date: closeDate,
            available_at: availableAt,
            confirmed_by: auth.ctx.memberId,
          })
          folletoCreated = true

          const availableLabel = new Date(`${availableAt}T00:00:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
          await notifyFolletoRecipients({
            title: 'Folletos solicitados',
            body: `${quantity} folleto${quantity !== 1 ? 's' : ''} de ${levelLabel(target)} · ${sede ?? 'sede sin definir'}`,
            subject: `Folletos de ${levelLabel(target)} — ${sede ?? 'sede sin definir'}`,
            html: `
              <p>Se solicitaron folletos a partir de un cierre de grupo.</p>
              <ul>
                <li><strong>Nivel:</strong> ${levelLabel(target)}</li>
                <li><strong>Cantidad:</strong> ${quantity}</li>
                <li><strong>Sede:</strong> ${sede ?? 'sin definir'}</li>
                <li><strong>Disponibilidad estimada:</strong> ${availableLabel} (listos para recoger en la sede)</li>
              </ul>
              <p>Podés seguir el estado en el sistema, en Estudios &rsaquo; Folletos.</p>
            `,
          })
        }
      } catch (e) {
        console.warn('No se pudo crear la solicitud de folletos:', e)
      }
    }

    return NextResponse.json({ ok: true, folletoCreated, autoEnrolled })
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

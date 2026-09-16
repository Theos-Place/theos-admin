import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { revokeScholarship, moveScholarship } from '@/lib/supabase/queries/scholarships'
import { MENSAJE_BLOQUEO, type MotivoBloqueo } from '@/lib/finance/cambio-de-destino-beca'
import {
  MENSAJE_BLOQUEO_CANCELACION, MENSAJE_MOTIVO_CORTO, motivoNormalizado,
} from '@/lib/finance/cancelacion-de-beca'
import { reportarError } from '@/lib/observabilidad'

// GET ?usage=1: cuántas veces se usó (para decidir DeleteConfirmModal vs ActiveWarningModal en el cliente).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('becas')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
    const supabase = createAdminClient()
    const [{ data: scholarship }, { count }] = await Promise.all([
      supabase.from('scholarships').select('status').eq('id', id).maybeSingle(),
      supabase.from('scholarship_redemptions').select('id', { count: 'exact', head: true }).eq('scholarship_id', id),
    ])
    const usedDirectly = (scholarship as { status: string } | null)?.status === 'used'
    return NextResponse.json({ used_count: (count ?? 0) + (usedDirectly ? 1 : 0) })
  } catch (error) {
    reportarError('GET /api/scholarships/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH { action: 'mover' | 'cancelar', ... }
//   'mover'    { entity_type, plan_id|event_id, motivo?, notificar? } — cambia el
//              destino de una beca asignada (el estudio original se llenó o se canceló).
//   'cancelar' { motivo } — cierra una beca sin usar dejando quién y por qué.
// Convención del repo: acción puntual como { action }, no un endpoint propio.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('becas', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
    const body = await req.json().catch(() => null)
    if (body?.action === 'cancelar') return cancelar(id, body, auth.ctx.userId)
    if (body?.action !== 'mover') {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { action: "debe ser 'mover' o 'cancelar'" } }, { status: 400 })
    }
    const entityType = body?.entity_type
    if (entityType !== 'study_plan' && entityType !== 'event') {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { entity_type: 'debe ser study_plan o event' } }, { status: 400 })
    }
    const entityId = entityType === 'study_plan' ? body?.plan_id : body?.event_id
    if (typeof entityId !== 'string' || !isUuid(entityId)) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { target: 'se requiere un destino válido' } }, { status: 400 })
    }

    const result = await moveScholarship(id, { entity_type: entityType, entity_id: entityId }, {
      motivo: typeof body?.motivo === 'string' ? body.motivo : null,
      notificar: body?.notificar !== false,
    })
    if (!result.ok) {
      if (result.error === 'no_encontrada') return NextResponse.json({ error: 'La beca no existe.' }, { status: 404 })
      // 'mismo_destino' y 'moneda_distinta' son datos que no cuadran (400); que
      // la beca ya se haya usado es un conflicto con su estado (409).
      const conflicto: MotivoBloqueo[] = ['no_activa', 'cupon_generico']
      return NextResponse.json(
        { error: MENSAJE_BLOQUEO[result.error], code: result.error },
        { status: conflicto.includes(result.error) ? 409 : 400 },
      )
    }
    return NextResponse.json({ ok: true, aviso: result.aviso, entity_name: result.entity_name })
  } catch (error) {
    reportarError('PATCH /api/scholarships/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Cancela una beca sin usar. El motivo es obligatorio y queda guardado con el
 * nombre de quien la canceló: una beca cancelada sin explicación es justo el
 * dato que después nadie encuentra.
 *
 * Reemplaza al viejo DELETE, que escribía status='revoked' y nada más. Se quitó
 * en vez de dejarlo conviviendo para no tener dos caminos que cancelan la misma
 * beca, uno de ellos sin pedir motivo — el rato que alguien use ese, la garantía
 * deja de valer.
 */
async function cancelar(id: string, body: unknown, actorUserId: string): Promise<NextResponse> {
  const motivo = motivoNormalizado((body as { motivo?: unknown })?.motivo)
  if (!motivo) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: { motivo: MENSAJE_MOTIVO_CORTO } }, { status: 400 })
  }
  const result = await revokeScholarship(id, { motivo, actorUserId })
  if (result.ok) return NextResponse.json({ ok: true })
  if (result.error === 'no_encontrada') return NextResponse.json({ error: 'La beca no existe.' }, { status: 404 })
  if (result.error === 'motivo_invalido') {
    return NextResponse.json({ error: 'Datos inválidos', detalles: { motivo: MENSAJE_MOTIVO_CORTO } }, { status: 400 })
  }
  // Que ya se haya usado o cancelado es un conflicto con su estado, no un dato malo.
  return NextResponse.json(
    { error: MENSAJE_BLOQUEO_CANCELACION[result.error], code: result.error },
    { status: 409 },
  )
}

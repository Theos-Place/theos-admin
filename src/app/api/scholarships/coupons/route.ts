import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getScholarshipsQueue, createGenericScholarship } from '@/lib/supabase/queries/scholarships'

// GET: lista becas/cupones (?kind=asignada|generica, ?status=active|used|revoked).
export async function GET(req: NextRequest) {
  const auth = await requireModuleView('becas')
  if (auth.res) return auth.res
  try {
    const { searchParams } = req.nextUrl
    const kind = searchParams.get('kind')
    const status = searchParams.get('status')
    const items = await getScholarshipsQueue({
      kind: kind === 'asignada' || kind === 'generica' ? kind : undefined,
      status: status === 'active' || status === 'used' || status === 'revoked' ? status : undefined,
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/scholarships/coupons:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: crea un cupón genérico directo (sin solicitud previa). Body:
// { entity_type, plan_id?|event_id?, discount_type, discount_value, code, expires_at? }
export async function POST(req: NextRequest) {
  const auth = await requireModuleView('becas', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const body = await req.json()
    const entityType = body?.entity_type
    if (entityType !== 'study_plan' && entityType !== 'event') {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { entity_type: 'debe ser study_plan o event' } }, { status: 400 })
    }
    const targetId = entityType === 'study_plan' ? body?.plan_id : body?.event_id
    if (typeof targetId !== 'string' || !isUuid(targetId)) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { target: 'se requiere un destino válido' } }, { status: 400 })
    }
    const discountType = body?.discount_type
    if (discountType !== 'percentage' && discountType !== 'fixed') {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { discount_type: 'debe ser percentage o fixed' } }, { status: 400 })
    }
    const discountValue = Number(body?.discount_value)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { discount_value: 'debe ser mayor a 0' } }, { status: 400 })
    }
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!code) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { code: 'requerido' } }, { status: 400 })
    }
    const expiresAt = typeof body?.expires_at === 'string' && body.expires_at ? body.expires_at : null
    if (!expiresAt) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: { expires_at: 'requerido para cupones genéricos' } }, { status: 400 })
    }

    const created = await createGenericScholarship({
      entity_type: entityType,
      plan_id: entityType === 'study_plan' ? targetId : null,
      event_id: entityType === 'event' ? targetId : null,
      discount_type: discountType,
      discount_value: discountValue,
      code,
      expires_at: expiresAt,
      created_by: auth.ctx.userId,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'CODIGO_DUPLICADO') {
      return NextResponse.json({ error: 'Ya existe un cupón con ese código.' }, { status: 409 })
    }
    console.error('POST /api/scholarships/coupons:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getScholarshipsQueue, createGenericScholarship } from '@/lib/supabase/queries/scholarships'
import { couponCreateSchema, idDelDestino } from '../schema'
import { datosInvalidos } from '@/lib/api/datos-invalidos'
import { reportarError } from '@/lib/observabilidad'

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
    reportarError('GET /api/scholarships/coupons:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: crea un cupón genérico directo (sin solicitud previa). Body:
// { entity_type, plan_id?|event_id?, discount_type, discount_value, code, expires_at? }
export async function POST(req: NextRequest) {
  const auth = await requireModuleView('becas', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const parsed = couponCreateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return datosInvalidos(parsed.error)
    const d = parsed.data
    const targetId = idDelDestino(d)

    const created = await createGenericScholarship({
      entity_type: d.entity_type,
      plan_id: d.entity_type === 'study_plan' ? targetId : null,
      event_id: d.entity_type === 'event' ? targetId : null,
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      code: d.code,
      expires_at: d.expires_at,
      created_by: auth.ctx.userId,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'CODIGO_DUPLICADO') {
      return NextResponse.json({ error: 'Ya existe un cupón con ese código.' }, { status: 409 })
    }
    reportarError('POST /api/scholarships/coupons:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getScholarships, createScholarship, type ScholarshipWriteInput } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    const auth = await requireModuleView('finanzas')
    if (auth.res) return auth.res
    return NextResponse.json(await getScholarships())
  } catch (error) {
    console.error('GET /api/finance/scholarships:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const body = (await req.json()) as ScholarshipWriteInput
    // Validación de negocio del descuento.
    if (!body.member_id || !isUuid(body.member_id)) {
      return NextResponse.json({ error: 'member_id inválido' }, { status: 400 })
    }
    const value = Number(body.discount_value)
    if (body.discount_type === 'percentage' && (!Number.isFinite(value) || value <= 0 || value > 100)) {
      return NextResponse.json({ error: 'El porcentaje debe estar entre 1 y 100' }, { status: 400 })
    }
    if (body.discount_type === 'fixed' && (!Number.isFinite(value) || value <= 0)) {
      return NextResponse.json({ error: 'El monto del descuento debe ser mayor a cero' }, { status: 400 })
    }
    const original = Number(body.original_amount)
    const final = Number(body.final_amount)
    if (!Number.isFinite(original) || original < 0 || !Number.isFinite(final) || final < 0 || final > original) {
      return NextResponse.json({ error: 'Montos inválidos (el final no puede exceder el original)' }, { status: 400 })
    }
    const s = await createScholarship(body)
    return NextResponse.json(s, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/scholarships:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

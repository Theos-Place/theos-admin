import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getScholarships, createScholarship } from '@/lib/supabase/queries/finance'

// Validación runtime del alta de becas. `.strict()` corta el mass assignment
// (el insert va con service role); `created_by` NO se acepta del cliente.
// Las reglas de montos (porcentaje 1–100, monto > 0, final ≤ original) se
// validan aparte para conservar los mensajes que muestra el frontend.
const scholarshipWriteSchema = z
  .object({
    member_id: z.uuid({ error: 'member_id inválido' }),
    entity_type: z.enum(['study_group', 'event']).nullish(),
    study_group_id: z.string().trim().min(1).nullish(),
    event_id: z.string().trim().min(1).nullish(),
    discount_type: z.enum(['percentage', 'fixed']),
    discount_value: z.number(),
    original_amount: z.number().min(0),
    final_amount: z.number().min(0),
    reason: z.string().trim().nullish(),
    notes: z.string().trim().nullish(),
  })
  .strict()

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
    const parsed = scholarshipWriteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const body = parsed.data
    // Validación de negocio del descuento (mismas reglas y mensajes de siempre;
    // finitud y montos ≥ 0 ya los garantiza el schema).
    if (body.discount_type === 'percentage' && (body.discount_value <= 0 || body.discount_value > 100)) {
      return NextResponse.json({ error: 'El porcentaje debe estar entre 1 y 100' }, { status: 400 })
    }
    if (body.discount_type === 'fixed' && body.discount_value <= 0) {
      return NextResponse.json({ error: 'El monto del descuento debe ser mayor a cero' }, { status: 400 })
    }
    if (body.final_amount > body.original_amount) {
      return NextResponse.json({ error: 'Montos inválidos (el final no puede exceder el original)' }, { status: 400 })
    }
    const s = await createScholarship(body)
    return NextResponse.json(s, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/scholarships:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

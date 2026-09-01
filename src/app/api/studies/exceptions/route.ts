import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { WAIVABLE } from '@/lib/studies/exception-scope'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { listExceptionsForMember, createException } from '@/lib/supabase/queries/study-exceptions'
import { REASON_MIN, REASON_MAX } from '@/lib/studies/exception-reason'

// La razón es OBLIGATORIA (2026-08-04): una excepción salta compromisos sin
// dejar rastro de por qué, y es la decisión más discrecional del módulo.
const exceptionSchema = z.object({
  member_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  // La lista viene de WAIVABLE, no escrita otra vez acá: agregar un permiso
  // nuevo y olvidar este enum lo rechaza con 400 y nadie entiende por qué.
  waived_requirements: z
    .array(z.enum(WAIVABLE))
    .min(1, 'Elegí al menos un requisito a eximir'),
  reason: z.string().trim().min(REASON_MIN, 'Contá en una frase por qué se hace la excepción').max(REASON_MAX),
}).strict()

// GET /api/studies/exceptions?member_id=X → excepciones del miembro.
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    return NextResponse.json(await listExceptionsForMember(memberId))
  } catch (error) {
    console.error('GET /api/studies/exceptions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/studies/exceptions → crea/actualiza una excepción activa.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const parsed = exceptionSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', code: 'datos_invalidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const result = await createException({
      member_id: parsed.data.member_id,
      plan_id: parsed.data.plan_id,
      waived_requirements: parsed.data.waived_requirements,
      reason: parsed.data.reason,
      granted_by: auth.ctx.memberId,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/exceptions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { contextoParaCongelar, congelarMatricula, NoSePuedeCongelar } from '@/lib/supabase/queries/creditos'
import { ROLES_QUE_CONGELAN } from '@/lib/finance/credito-por-congelar'
import { reportarError } from '@/lib/observabilidad'

/**
 * FIN-9 · Congelar una matrícula y emitir el crédito.
 *
 * FINANZAS Y QUIEN LLEVA LOS ESTUDIOS, y eso es parte del diseño: se emite
 * caso por caso y después de hablar con la persona. No hay autoservicio ni
 * se promociona — si «congelar» se vuelve un clic para cualquiera, deja de
 * ser la excepción que es y se come la matrícula normal.
 *
 * La MISMA lista que usa el botón de la ficha: escrita en los dos lados se
 * separa, y entonces aparece un botón que al tocarlo da 403 (UX-7).
 */
const ROLES = ROLES_QUE_CONGELAN

const bodySchema = z.object({
  enrollment_id: z.string().uuid(),
  // El porqué es OBLIGATORIO: dentro de seis meses, «¿por qué esta persona
  // tiene ₡5.000 guardados?» tiene que responderse sin preguntarle a nadie.
  motivo: z.string().trim().min(10, 'Contá por qué se congela, aunque sea en una línea.').max(500),
}).strict()

/** GET ?enrollment_id= — cuánto se congelaría y si se puede. */
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...ROLES)
  if (auth.res) return auth.res
  try {
    const id = req.nextUrl.searchParams.get('enrollment_id')
    if (!id) return NextResponse.json({ error: 'Falta enrollment_id' }, { status: 400 })
    const ctx = await contextoParaCongelar(id)
    if (!ctx) return NextResponse.json({ error: 'No se encontró la matrícula.' }, { status: 404 })
    return NextResponse.json(ctx)
  } catch (error) {
    reportarError('GET /api/finance/creditos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(...ROLES)
  if (auth.res) return auth.res
  try {
    if (!auth.ctx.memberId) {
      return NextResponse.json({ error: 'Tu usuario no está vinculado a un perfil de miembro' }, { status: 409 })
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const r = await congelarMatricula({
      enrollmentId: parsed.data.enrollment_id,
      motivo: parsed.data.motivo,
      actorUserId: auth.ctx.userId,
    })
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'INSERT',
      entityType: 'scholarships',
      entityId: r.credito_id,
      newData: {
        kind: 'credito', enrollment_id: parsed.data.enrollment_id,
        monto: r.monto, vence: r.vence, motivo: parsed.data.motivo,
      },
    })
    return NextResponse.json(r, { status: 201 })
  } catch (error) {
    if (error instanceof NoSePuedeCongelar) {
      return NextResponse.json({ error: error.message, code: 'no_se_puede_congelar' }, { status: 409 })
    }
    reportarError('POST /api/finance/creditos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

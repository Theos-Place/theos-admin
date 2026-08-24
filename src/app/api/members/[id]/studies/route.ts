import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { EXTERNAL_STUDY_ROLES } from '@/lib/auth/roles'
import { addMemberStudy, getPlanIdByCode } from '@/lib/supabase/queries/studies'

// Registrar A MANO un estudio en el expediente de alguien. El caso principal es
// el estudio llevado POR FUERA de Theos (otra iglesia, otro ministerio).
//
// Gate: la lista más corta del módulo (admin + coordinador de estudios). Un
// estudio registrado cuenta como PRERREQUISITO, así que quien puede escribirlo
// habilita a la persona para todo lo que venga después.
const bodySchema = z.object({
  plan_code: z.string().trim().min(1),
  date: z.string().trim().min(1).nullish(),
  status: z.enum(['completed', 'dropped', 'enrolled']).default('completed'),
  es_externo: z.boolean().default(false),
  fuente_externa: z.string().trim().max(200).nullish(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...EXTERNAL_STUDY_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const b = parsed.data
    // Espejo del CHECK de la base: la procedencia sin "es externo" no significa
    // nada. Se responde 400 con un mensaje legible en vez de dejar que reviente
    // el motor con el nombre de la restricción.
    if (!b.es_externo && b.fuente_externa?.trim()) {
      return NextResponse.json(
        { error: 'Para indicar de dónde lo trajo, marcá el estudio como llevado por fuera.' },
        { status: 400 },
      )
    }

    const planId = await getPlanIdByCode(b.plan_code)
    if (!planId) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    await addMemberStudy({
      member_id: id,
      plan_id: planId,
      completed_at: b.date ? `${b.date}T12:00:00+00` : null,
      status: b.status,
      es_externo: b.es_externo,
      fuente_externa: b.fuente_externa ?? null,
      // Quién lo digitó. Nunca es la propia persona: el rol base no llega acá.
      recorded_by: auth.ctx.memberId,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/members/[id]/studies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

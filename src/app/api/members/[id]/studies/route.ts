import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { EXTERNAL_STUDY_ROLES } from '@/lib/auth/roles'
import { addMemberStudy, getPlanIdByCode, getMemberStudyCodes } from '@/lib/supabase/queries/studies'

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


/**
 * GET · los estudios que esta persona YA tiene registrados.
 *
 * Existe para que el formulario de "Agregar estudio" pueda avisar antes de
 * guardar. Sin esto no había forma de saberlo desde el modal, y el 2026-08-25
 * alguien registró el mismo SCJ dos veces (con orígenes distintos) sin que nada
 * lo advirtiera.
 *
 * Liviano a propósito: solo lo necesario para el aviso. El detalle completo del
 * expediente ya lo sirve GET /api/members/[id].
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...EXTERNAL_STUDY_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const items = await getMemberStudyCodes(id)
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/members/[id]/studies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

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

    // Red de seguridad contra el duplicado EXACTO (mismo plan, misma fecha).
    // El aviso de la pantalla cubre el caso normal —"esta persona ya tiene N2"—
    // pero no el doble clic ni el doble envío, que llegan acá sin pasar por él.
    //
    // Solo se rechaza lo IDÉNTICO: repetir un estudio en otra fecha es
    // legítimo y tiene que seguir pasando. El 409 lleva un mensaje que dice qué
    // hacer, no solo que falló.
    const yaTiene = await getMemberStudyCodes(id)
    const igual = yaTiene.find(y => y.code === b.plan_code && y.date === (b.date ?? null))
    if (igual) {
      return NextResponse.json({
        error: `Esta persona ya tiene ${b.plan_code} registrado con esa misma fecha (${igual.status}). `
          + 'Si lo llevó otra vez, cambiá la fecha; si no, no hace falta agregarlo.',
        code: 'estudio_duplicado',
      }, { status: 409 })
    }

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

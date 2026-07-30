import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { SELECTION_REVIEW_ROLES, SELECTION_STATUSES } from '@/lib/forms/selection-rules'
import {
  getSelectionData, saveSelectionReview, inviteSelected, convokeSelection,
} from '@/lib/supabase/queries/form-selection'

// EST-10: revisión/selección del comité sobre un formulario de preinscripción.
// Las respuestas traen testimonio y luchas personales: gate estricto a
// SELECTION_REVIEW_ROLES en TODOS los métodos (ni direccion las ve).

// GET → { form, labels, rows }
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...SELECTION_REVIEW_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const data = await getSelectionData(id)
    if (!data) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/forms/[id]/selection:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const reviewSchema = z.object({
  response_id: z.string().uuid(),
  status: z.enum(SELECTION_STATUSES as [string, ...string[]]).optional(),
  notes: z.string().max(4000).nullable().optional(),
}).refine(b => b.status !== undefined || b.notes !== undefined, {
  message: 'Se requiere status o notes',
})

// PATCH { response_id, status?, notes? } → guarda la decisión / las notas.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...SELECTION_REVIEW_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = reviewSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 },
      )
    }
    await saveSelectionReview({
      formId: id,
      responseId: parsed.data.response_id,
      status: parsed.data.status as Parameters<typeof saveSelectionReview>[0]['status'],
      notes: parsed.data.notes,
      reviewedBy: auth.ctx.memberId,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'RESPUESTA_NO_ENCONTRADA') {
      return NextResponse.json({ error: 'Esa respuesta no pertenece a este formulario' }, { status: 404 })
    }
    console.error('PATCH /api/forms/[id]/selection:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('invite'),
    response_ids: z.array(z.string().uuid()).min(1).max(500),
    template_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal('convoke'),
    member_ids: z.array(z.string().uuid()).min(1).max(2000),
    template_id: z.string().uuid(),
  }),
])

// POST { action: 'invite' | 'convoke', ... } → invitación + correo / convocatoria.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...SELECTION_REVIEW_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = actionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 },
      )
    }
    if (parsed.data.action === 'convoke') {
      return NextResponse.json(await convokeSelection({
        formId: id,
        templateId: parsed.data.template_id,
        memberIds: parsed.data.member_ids,
      }))
    }
    const result = await inviteSelected({
      formId: id,
      responseIds: parsed.data.response_ids,
      templateId: parsed.data.template_id,
      invitedBy: auth.ctx.memberId,
    })
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    const known: Record<string, { error: string; status: number }> = {
      FORM_NO_ENCONTRADO: { error: 'Formulario no encontrado', status: 404 },
      FORM_SIN_PLAN: { error: 'Este formulario no está ligado a un plan de estudio (falta la pregunta de grupo)', status: 409 },
      PLAN_NO_ENCONTRADO: { error: 'No existe un plan con ese código', status: 409 },
      PLANTILLA_NO_ENCONTRADA: { error: 'La plantilla de correo no existe', status: 404 },
      EMAIL_NOT_CONFIGURED: { error: 'El correo no está configurado (faltan las variables de SES)', status: 409 },
    }
    if (known[msg]) return NextResponse.json({ error: known[msg].error }, { status: known[msg].status })
    console.error('POST /api/forms/[id]/selection:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

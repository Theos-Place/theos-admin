import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireFormEdit } from '@/lib/auth/event-guard'
import { isUuid } from '@/lib/validate'
import {
  getFormAccessGrants, grantFormAccess, revokeFormAccess, getFormById,
} from '@/lib/supabase/queries/forms'

// Accesos puntuales a UN formulario.
//
// Quién los administra: el mismo requireFormEdit que guarda la edición del
// formulario — el módulo, el encargado del evento al que pertenece, o alguien a
// quien ya se lo compartieron. Eso último es decisión del usuario (2026-09-11):
// a quien se le comparte un formulario lleva esa actividad, y armar su equipo
// es parte de llevarla. Es POR FORMULARIO: no toca ningún otro.
//
// Consecuencia asumida: quien recibió el acceso también puede quitarlo, incluido
// el de quien se lo dio. Sin eso no podría corregir un error propio, y el módulo
// siempre ve la lista completa y la puede arreglar.

const grantSchema = z.object({ member_id: z.string().uuid() })

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    const auth = await requireFormEdit(id)
    if (auth.res) return auth.res
    return NextResponse.json(await getFormAccessGrants(id))
  } catch (error) {
    console.error('GET /api/forms/[id]/access:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    const auth = await requireFormEdit(id)
    if (auth.res) return auth.res
    const parsed = grantSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    if (!(await getFormById(id))) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }
    await grantFormAccess(id, parsed.data.member_id, auth.ctx.memberId)
    const grants = await getFormAccessGrants(id)
    const created = grants.find(g => g.member_id === parsed.data.member_id)
    return NextResponse.json(created ?? { ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms/[id]/access:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE ?member_id=<uuid> — quita el acceso de esa persona a este formulario.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const memberId = req.nextUrl.searchParams.get('member_id') ?? ''
    if (!isUuid(id) || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    const auth = await requireFormEdit(id)
    if (auth.res) return auth.res
    await revokeFormAccess(id, memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/forms/[id]/access:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

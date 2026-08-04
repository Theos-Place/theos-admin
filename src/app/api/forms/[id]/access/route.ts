import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import {
  getFormAccessGrants, grantFormAccess, revokeFormAccess, getFormById,
} from '@/lib/supabase/queries/forms'

// Accesos puntuales a UN formulario (ver y exportar sus respuestas).
// Administrarlos exige el MÓDULO formularios con permiso de edición — quien
// tiene solo un acceso puntual no puede repartir accesos.

const grantSchema = z.object({ member_id: z.string().uuid() })

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireModuleView('formularios', { action: 'edit' })
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })

    return NextResponse.json(await getFormAccessGrants(id))
  } catch (error) {
    console.error('GET /api/forms/[id]/access:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireModuleView('formularios', { action: 'edit' })
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
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
    const auth = await requireModuleView('formularios', { action: 'edit' })
    if (auth.res) return auth.res
    const { id } = await params
    const memberId = req.nextUrl.searchParams.get('member_id') ?? ''
    if (!isUuid(id) || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    await revokeFormAccess(id, memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/forms/[id]/access:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

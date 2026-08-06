import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { EVENT_ADMIN_ROLES } from '@/lib/auth/events-scope'
import { isUuid } from '@/lib/validate'
import {
  getEventManagers, grantEventManager, revokeEventManager, getEventById,
} from '@/lib/supabase/queries/events'

// Encargados de UN evento (FRM-1 parte B). Nombrar y quitar es de quien
// ADMINISTRA eventos: el encargado recibe el permiso, no lo reparte.

const grantSchema = z.object({ member_id: z.string().uuid() }).strict()

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles(...EVENT_ADMIN_ROLES)
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    return NextResponse.json(await getEventManagers(id))
  } catch (error) {
    console.error('GET /api/events/[id]/managers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles(...EVENT_ADMIN_ROLES)
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    const parsed = grantSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    // El evento tiene que existir: si no, el encargado queda colgando de nada.
    if (!(await getEventById(id))) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }
    await grantEventManager(id, parsed.data.member_id, auth.ctx.memberId)
    const lista = await getEventManagers(id)
    const creado = lista.find(m => m.member_id === parsed.data.member_id)
    return NextResponse.json(creado ?? { ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/events/[id]/managers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE ?member_id=<uuid>
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles(...EVENT_ADMIN_ROLES)
    if (auth.res) return auth.res
    const { id } = await params
    const memberId = req.nextUrl.searchParams.get('member_id') ?? ''
    if (!isUuid(id) || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    await revokeEventManager(id, memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/events/[id]/managers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

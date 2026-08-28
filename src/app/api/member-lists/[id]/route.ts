import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberListById, updateMemberList, deleteMemberList, recomputeMemberList } from '@/lib/supabase/queries/member-lists'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    const list = await getMemberListById(id)
    if (!list) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
    // Una lista DINÁMICA se recalcula acá, al leerla. Es lo que su nombre
    // promete y lo que el banner de la pantalla decía sin que nadie lo
    // cumpliera: `filters` se guardaba y nada lo volvía a correr.
    //
    // Se recalcula en el GET y no en un cron para que quien abra la lista vea
    // el dato de HOY, y para que "Comunicar a esta lista" —que sale de esta
    // misma respuesta— no mande a una audiencia vieja.
    //
    // Best-effort: si el recálculo falla, se devuelve la última membresía
    // conocida en vez de romper la pantalla.
    if (list.is_dynamic) {
      try {
        const r = await recomputeMemberList(id)
        if (r.ok) return NextResponse.json(r.list)
      } catch (e) {
        console.warn('recálculo de lista dinámica falló, se devuelve la última conocida:', e)
      }
    }
    return NextResponse.json(list)
  } catch (error) {
    console.error('GET /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRoles('comunicaciones', 'direccion', 'editor_perfiles', 'coordinador_estudios')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateMemberList(id, await req.json())
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRoles('comunicaciones', 'direccion', 'editor_perfiles', 'coordinador_estudios')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteMemberList(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { recomputeMemberList } from '@/lib/supabase/queries/member-lists'

// POST: vuelve a correr los filtros guardados de la lista y reescribe su
// membresía. Lo usan el botón "Actualizar" de las listas snapshot y la pantalla
// de detalle al abrir una lista dinámica.
//
// Escribe, así que pide los mismos roles que editar una lista.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('comunicaciones', 'direccion', 'editor_perfiles', 'coordinador_estudios')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const r = await recomputeMemberList(id)
    if (!r.ok) {
      return NextResponse.json({ error: r.motivo, code: 'sin_filtros' }, { status: 409 })
    }
    return NextResponse.json({ ok: true, antes: r.antes, despues: r.despues, list: r.list })
  } catch (error) {
    console.error('POST /api/member-lists/[id]/refresh:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

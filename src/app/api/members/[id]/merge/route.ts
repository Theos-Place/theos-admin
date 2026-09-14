import { NextRequest, NextResponse } from 'next/server'
import { mergeMembersResuelto, fusionErrorResponse } from '@/lib/supabase/queries/members-mutations'
import { requireRoles } from '@/lib/auth/guard'

/**
 * POST: fusiona el duplicado en este miembro, con la resolución campo por campo.
 *
 * `resueltos` es OBLIGATORIO aunque venga vacío: es la marca de que alguien pasó
 * por la pantalla de resolución. Antes había una segunda puerta —el "Fusionar
 * duplicado" de la ficha— que mandaba solo el id y el endpoint fusionaba con
 * borrado duro sin preguntar nada; por ahí se perdió el segundo apellido de
 * Zully Murillo Sánchez. Ahora esa llamada rebota con 400 en vez de destruir.
 *
 * La bitácora y el `soft` los maneja el RPC: siempre suave, siempre con la foto
 * del descartado.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles('admin', 'editor_perfiles')
    if (auth.res) return auth.res
    const { id } = await params // miembro que se CONSERVA
    const body = (await req.json().catch(() => ({}))) as {
      duplicate_id?: string; resueltos?: Record<string, unknown>
    }
    if (!body.duplicate_id) return NextResponse.json({ error: 'Falta duplicate_id' }, { status: 400 })
    if (body.duplicate_id === id) return NextResponse.json({ error: 'No se puede fusionar consigo mismo' }, { status: 400 })
    if (!body.resueltos || typeof body.resueltos !== 'object') {
      return NextResponse.json({
        error: 'Falta la resolución campo por campo. Fusioná desde la pantalla de duplicados.',
        code: 'sin_resolucion',
      }, { status: 400 })
    }

    const r = await mergeMembersResuelto(id, body.duplicate_id, {
      resueltos: body.resueltos, actorUserId: auth.ctx.userId,
    })
    return NextResponse.json({ ok: true, ...r })
  } catch (error) {
    const conflicto = fusionErrorResponse(error)
    if (conflicto) return NextResponse.json(conflicto, { status: 409 })
    console.error('POST /api/members/[id]/merge:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

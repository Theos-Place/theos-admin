import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { assignVolunteer, removeVolunteer } from '@/lib/supabase/queries/servers'
import { reportarError } from '@/lib/observabilidad'

// POST: asigna un servidor a una posición. Body: { position_id, member_id }
export async function POST(req: NextRequest) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { position_id, member_id } = await req.json()
    await assignVolunteer(position_id, member_id, auth.ctx.userId)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    // Entrar al Comité Dirigentes es volverse dirigente activo: se aplican los
    // mismos bloqueos que en la pantalla de dirigentes, con su motivo, para que
    // no salga un "Error interno" que no explica nada.
    if (error instanceof Error && error.message === 'DIRIGENTE_NO_RECOMENDADO') {
      return NextResponse.json({
        error: 'No se puede agregar al Comité Dirigentes: está marcada como no recomendada para dar estudios.',
        code: 'no_recomendado',
      }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'DIRIGENTE_EN_REVISION') {
      return NextResponse.json({
        error: 'No se puede agregar al Comité Dirigentes: su caso está en revisión. Eso lo resuelve la coordinación de dirigentes.',
        code: 'dirigente_en_revision',
      }, { status: 409 })
    }
    reportarError('POST /api/servers/volunteers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: da de baja (status inactive). Body: { position_id, member_id }
export async function DELETE(req: NextRequest) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { position_id, member_id } = await req.json()
    await removeVolunteer(position_id, member_id, auth.ctx.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Quitar a alguien del Comité Dirigentes lo desactiva como dirigente; si
    // está dando un grupo, no se hace. Mismo criterio que la pantalla de
    // dirigentes, para que dé igual por dónde se entre.
    if (error instanceof Error && error.message === 'DIRIGENTE_CON_GRUPO_ACTIVO') {
      return NextResponse.json({
        error: 'No se puede quitar del Comité Dirigentes: tiene un grupo de estudio en curso o abierto. Cerrá o reasigná el grupo primero.',
        code: 'has_active_groups',
      }, { status: 409 })
    }
    reportarError('DELETE /api/servers/volunteers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

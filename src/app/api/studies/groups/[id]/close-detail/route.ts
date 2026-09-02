import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getCierreDetalle } from '@/lib/supabase/queries/studies'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: cómo terminó un grupo ya cerrado — quién aprobó, quién no y por qué.
//
// Lo ve quien gestiona estudios, quien imprime folletos (el tiquete enlaza acá
// para entender la cantidad) y el dirigente o co-dirigente DEL GRUPO: es su
// propio cierre y no tiene por qué pedirle a nadie que se lo lea.
const GESTION = ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin', 'folletos']

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const { id } = await params
  try {
    if (!auth.ctx.roles.some(r => GESTION.includes(r))) {
      const { data } = await createAdminClient()
        .from('study_groups').select('leader_id, co_leader_id').eq('id', id).maybeSingle()
      const g = data as { leader_id: string | null; co_leader_id: string | null } | null
      const esSuyo = !!auth.ctx.memberId && !!g
        && (g.leader_id === auth.ctx.memberId || g.co_leader_id === auth.ctx.memberId)
      if (!esSuyo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const detalle = await getCierreDetalle(id)
    if (!detalle) return NextResponse.json({ error: 'Ese grupo no existe.' }, { status: 404 })
    return NextResponse.json(detalle)
  } catch (error) {
    console.error('GET /api/studies/groups/[id]/close-detail:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

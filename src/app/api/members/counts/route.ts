import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { moduleScope } from '@/lib/auth/roles'
import { getMemberCounts } from '@/lib/supabase/queries/members'

// GET: conteos para los chips/header (total, donadores, servidores, activos_asistencia).
export async function GET() {
  try {
    const auth = await requireModuleView('miembros', { beyondOwn: true })
    // SEC-1: el PADRÓN completo exige alcance 'all' — lider_comite (scope
    // 'committee') pasaba el beyondOwn y podía listar/exportar todo; a su
    // gente la ve por /servidores (detalle del comité).
    if (auth.ctx && moduleScope(auth.ctx.roles, 'miembros') !== 'all') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (auth.res) return auth.res
    return NextResponse.json(await getMemberCounts())
  } catch (error) {
    console.error('GET /api/members/counts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

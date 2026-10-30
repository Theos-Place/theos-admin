import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { enviosProgramadosConLaLista } from '@/lib/supabase/queries/member-lists'
import { ROLES_QUE_GESTIONAN_LISTAS } from '@/lib/members/editar-lista'
import { reportarError } from '@/lib/observabilidad'

// PAR-9 · GET: los comunicados PROGRAMADOS que salen a esta lista, para el
// aviso de impacto antes de cambiarle el filtro. Lo pide quien la puede editar.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...ROLES_QUE_GESTIONAN_LISTAS)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    return NextResponse.json({ items: await enviosProgramadosConLaLista(id) })
  } catch (error) {
    reportarError('GET /api/member-lists/[id]/scheduled-broadcasts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

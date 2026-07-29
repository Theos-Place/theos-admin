import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getRequestsForGroup } from '@/lib/supabase/queries/prematrimonial'

// GET: parejas de un grupo prematrimonial (solicitudes con resulting_group_id =
// grupo) — el form de evaluación del cierre necesita una fila por pareja.
// Solo nombres + request_id: no expone la logística ni la ceremonia.
// PRE-8: mismos roles que pueden CERRAR el grupo (el contenido de la
// evaluación se lee aparte, con gate más estrecho).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const pairs = await getRequestsForGroup(id)
    return NextResponse.json({
      items: pairs.map(p => ({
        request_id: p.id,
        requester_name: `${p.requester?.first_name ?? ''} ${p.requester?.last_name ?? ''}`.trim(),
        spouse_name: `${p.spouse?.first_name ?? ''} ${p.spouse?.last_name ?? ''}`.trim(),
      })),
    })
  } catch (error) {
    console.error('GET /api/studies/groups/[id]/premat-pairs:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

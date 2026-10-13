import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getRequestsForGroup, getParticipantesDelGrupo } from '@/lib/supabase/queries/prematrimonial'
import { reportarError } from '@/lib/observabilidad'

// GET: parejas de un grupo prematrimonial (solicitudes con resulting_group_id =
// grupo) — el form de evaluación del cierre necesita una fila por pareja.
// Solo nombres + request_id: no expone la logística ni la ceremonia.
// PRE-8: mismos roles que pueden CERRAR el grupo (el contenido de la
// evaluación se lee aparte, con gate más estrecho).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params

    /**
     * MISMO criterio que el endpoint de CIERRE, y ahora de verdad: la regla
     * vive en `lib/studies/quien-cierra` y la usan los dos.
     *
     * Antes acá había una lista propia con tres roles, y el comentario decía
     * «mismos roles que pueden cerrar». No lo eran: al de cierre le faltaba
     * el DIRIGENTE del grupo. Floriana, co-dirigente de su prematrimonial,
     * podía cerrar pero recibía 403 al cargar las parejas, y la pantalla
     * decía «no se pudieron cargar» sin aclarar que era un permiso.
     */
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data: g } = await createAdminClient()
      .from('study_groups').select('leader_id, co_leader_id').eq('id', id).maybeSingle()
    const { puedeCerrarEsteGrupo } = await import('@/lib/studies/quien-cierra')
    if (!puedeCerrarEsteGrupo({
      roles: auth.ctx.roles,
      memberId: auth.ctx.memberId,
      grupo: g as { leader_id: string | null; co_leader_id: string | null } | null,
    })) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const pairs = await getRequestsForGroup(id)

    /**
     * PRE-8 (2026-10-13) · Si el grupo no nació de la cola, la pareja son
     * sus PARTICIPANTES.
     *
     * Antes esto devolvía una lista vacía y el cierre se quedaba sin
     * formulario: los cinco grupos prematrimoniales abiertos se crearon a
     * mano y en toda la base hay una sola solicitud, pendiente y sin grupo.
     */
    const { parejasDelCierre } = await import('@/lib/studies/pareja-del-cierre')
    const participantes = pairs.length > 0 ? [] : await getParticipantesDelGrupo(id)
    const parejas = parejasDelCierre({
      solicitudes: pairs.map(p => ({
        id: p.id,
        requester_name: `${p.requester?.first_name ?? ''} ${p.requester?.last_name ?? ''}`.trim(),
        spouse_name: `${p.spouse?.first_name ?? ''} ${p.spouse?.last_name ?? ''}`.trim(),
      })),
      participantes,
      groupId: id,
    })
    return NextResponse.json({
      items: parejas.map(p => ({
        request_id: p.clave,
        de_solicitud: p.deSolicitud,
        // Un solo campo con los dos nombres ya armados: con participantes no
        // hay «quien pide» y «cónyuge», son dos personas del mismo grupo.
        requester_name: p.nombres,
        spouse_name: '',
      })),
    })
  } catch (error) {
    reportarError('GET /api/studies/groups/[id]/premat-pairs:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getGroupById, saveGroupAttendance } from '@/lib/supabase/queries/studies'
import { groupViewerScope } from '@/lib/auth/studies-scope'
import { reportarError } from '@/lib/observabilidad'

// POST: registra la asistencia de una sesión.
// Body: { session_date, topic?, notes?, attendance: [{ member_id, present }] }
//
// QUIÉN PUEDE. El DIRIGENTE de este grupo (o su codirigente) y las
// coordinaciones. Pasar lista es el trabajo del dirigente: la pantalla está
// hecha para él y la abre desde su propio grupo.
//
// BUG 2026-09-22, reportado por una dirigente: el guard era
// `requireRoles('coordinador_estudios','coordinador_dirigentes','direccion')`,
// así que quien dirigía el grupo marcaba la lista, tocaba Guardar y recibía
// "No se pudo guardar la asistencia". Venía del barrido de seguridad
// `00b55074`, que le puso roles a todos los endpoints mutantes de una pasada —
// y acá dejó afuera justo a la persona para la que existe la pantalla.
//
// El permiso se resuelve CONTRA ESTE GRUPO con `groupViewerScope`, el mismo
// que ya usan el detalle y las sesiones. Un dirigente sigue sin poder tocar la
// asistencia de un grupo ajeno: ahí su alcance es 'none'.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const group = await getGroupById(id)
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })

    const g = group as unknown as { leader_id: string | null; co_leader_id: string | null }
    const alcance = groupViewerScope({
      roles: auth.ctx.roles,
      memberId: auth.ctx.memberId,
      group: g,
      // Estar inscrito no da permiso de pasar lista: solo dirigir o coordinar.
      isEnrolled: false,
    })
    if (alcance !== 'admin' && alcance !== 'leader') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await req.json()
    if (!body?.session_date || !Array.isArray(body?.attendance)) {
      return NextResponse.json({ error: 'Se requiere session_date y attendance[]' }, { status: 400 })
    }
    const res = await saveGroupAttendance(id, body)
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    reportarError('POST /api/studies/groups/[id]/attendance:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { groupViewerScope } from '@/lib/auth/studies-scope'
import {
  getGroupLeaderIds, getSessionForEdit, updateGroupSession, deleteGroupSession,
} from '@/lib/supabase/queries/studies'
import { motivoQueImpide, diferencia, hayCambios } from '@/lib/studies/correccion-de-asistencia'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * Corregir o borrar una sesión de asistencia.
 *
 * POR QUÉ EXISTE. Pasar lista era solo de ida. El 2026-09-10 el grupo
 * «Nivel 2. Eric Arguello» quedó con DOS sesiones de la misma fecha —una con
 * 10 presentes y otra con 2— porque alguien pasó lista dos veces y no había
 * forma de borrar la mala: se quedó contando como una sesión más y bajándole
 * el promedio a todo el grupo. Reportado por Floriana el 2026-10-07.
 *
 * QUIÉN. Exactamente los mismos que pueden pasar lista: el dirigente de ESTE
 * grupo (o su codirigente) y las coordinaciones, vía `groupViewerScope`. No
 * es una lista nueva — una segunda lista es cómo se desalinean.
 *
 * TODO QUEDA EN LA BITÁCORA, con el antes y el después. Corregir asistencia
 * es cambiar el registro de algo que ya pasó: sin rastro, «¿quién le quitó
 * la falta?» no se contesta.
 */

const marcaSchema = z.object({ member_id: z.uuid(), present: z.boolean() })

const patchSchema = z.object({
  session_date: z.string().optional(),
  topic: z.string().nullable().optional(),
  marcas: z.array(marcaSchema).optional(),
})

/** El permiso y la sesión, en un solo lugar: los dos métodos lo necesitan
 *  igual y escribirlo dos veces es cómo uno de los dos se afloja. */
async function puertaDeEntrada(groupId: string, sessionId: string) {
  const auth = await requireRoles()
  if (auth.res) return { res: auth.res } as const

  const leaders = await getGroupLeaderIds(groupId)
  if (!leaders) {
    return { res: NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 }) } as const
  }
  const scope = groupViewerScope({
    roles: auth.ctx.roles,
    memberId: auth.ctx.memberId,
    group: leaders,
    // Estar inscrito no da permiso de corregir la lista, igual que no lo da
    // para pasarla.
    isEnrolled: false,
  })
  if (scope !== 'admin' && scope !== 'leader') {
    return { res: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) } as const
  }

  const sesion = await getSessionForEdit(groupId, sessionId)
  if (!sesion) {
    return { res: NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 }) } as const
  }
  return { ctx: auth.ctx, sesion } as const
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    const { id, sessionId } = await params
    const puerta = await puertaDeEntrada(id, sessionId)
    if (puerta.res) return puerta.res

    const parsed = patchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const cambio = parsed.data

    // Las reglas que la pantalla ya aplicó, aplicadas otra vez acá: la
    // pantalla no es la que decide qué es válido.
    const motivo = motivoQueImpide(cambio)
    if (motivo) return NextResponse.json({ error: motivo }, { status: 400 })

    const d = diferencia(puerta.sesion, cambio)
    if (!hayCambios(d)) return NextResponse.json({ ok: true, sinCambios: true })

    await updateGroupSession(id, sessionId, cambio)
    await logAudit({
      actorUserId: puerta.ctx.userId,
      action: 'UPDATE',
      entityType: 'study_session',
      entityId: sessionId,
      oldData: { session_date: puerta.sesion.session_date, topic: puerta.sesion.topic, marcas: puerta.sesion.marcas },
      newData: { grupo: id, cambio, diferencia: d },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('PATCH /api/studies/groups/[id]/sessions/[sessionId]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    const { id, sessionId } = await params
    const puerta = await puertaDeEntrada(id, sessionId)
    if (puerta.res) return puerta.res

    // La sesión entera va a la bitácora ANTES de borrarla: después no hay de
    // dónde sacarla, y «se borró una sesión» sin decir cuál no sirve de nada.
    await logAudit({
      actorUserId: puerta.ctx.userId,
      action: 'DELETE',
      entityType: 'study_session',
      entityId: sessionId,
      oldData: { grupo: id, ...puerta.sesion },
      newData: null,
    })
    await deleteGroupSession(id, sessionId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('DELETE /api/studies/groups/[id]/sessions/[sessionId]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

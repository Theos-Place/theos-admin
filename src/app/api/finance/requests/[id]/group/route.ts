import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { cambiarGrupoDeSolicitud } from '@/lib/supabase/queries/finance-requests'
import { isUuid } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * BEC-5 punto 5 · La persona cambia el grupo de su solicitud de beca cuando
 * el que había elegido se llenó.
 *
 * SIN ROL. Es el dueño de la solicitud quien entra acá, y la pertenencia la
 * verifica la query leyendo `member_id` de la fila — no un campo del cuerpo,
 * que cualquiera se pondría. Sin sesión no se pasa: `requireRoles()` sin
 * argumentos exige estar autenticado.
 *
 * Endpoint aparte y no una `action` del PATCH de al lado porque ese pide rol
 * finanzas para todo el handler. Mezclarlos obligaría a abrirle el guard a
 * acciones que sí son de finanzas.
 */
const bodySchema = z.object({ study_group_id: z.string().uuid() }).strict()

const ERRORES: Record<string, { error: string; status: number }> = {
  SOLICITUD_NO_ENCONTRADA: { error: 'No se encontró la solicitud.', status: 404 },
  NO_ES_SUYA: { error: 'Esta solicitud no es tuya.', status: 403 },
  NO_SE_PUEDE_CAMBIAR: {
    error: 'El grupo solo se puede cambiar cuando la solicitud quedó por modificar.',
    status: 409,
  },
  GRUPO_NO_ENCONTRADO: { error: 'No se encontró el grupo.', status: 404 },
  GRUPO_DE_OTRO_ESTUDIO: {
    error: 'Ese grupo es de otro estudio. Para pedir beca de otro estudio hay que hacer una '
      + 'solicitud nueva.',
    status: 409,
  },
  GRUPO_LLENO: { error: 'Ese grupo también está lleno. Elegí otro.', status: 409 },
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    if (!auth.ctx.memberId) {
      return NextResponse.json({ error: 'Tu usuario no está vinculado a un perfil de miembro' }, { status: 409 })
    }
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'No se encontró la solicitud.' }, { status: 404 })

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    const actualizada = await cambiarGrupoDeSolicitud(id, parsed.data.study_group_id, auth.ctx.memberId)
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'finance_requests',
      entityId: id,
      newData: { study_group_id: parsed.data.study_group_id, status: 'open' },
    })
    return NextResponse.json(actualizada)
  } catch (error) {
    const known = error instanceof Error ? ERRORES[error.message] : undefined
    if (known) {
      return NextResponse.json(
        { error: known.error, code: (error as Error).message.toLowerCase() },
        { status: known.status },
      )
    }
    reportarError('PATCH /api/finance/requests/[id]/group:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

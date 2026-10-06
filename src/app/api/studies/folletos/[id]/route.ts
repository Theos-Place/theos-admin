import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getFolletoDetalle } from '@/lib/supabase/queries/folletos'
import { reportarError } from '@/lib/observabilidad'

// GET: detalle de un tiquete de folletos — grupo, dirigentes, ubicación, sede
// de entrega, desglose de la cantidad y, si vino de un cierre, cómo terminó el
// grupo anterior. Módulo 'folletos'.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('folletos')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const detalle = await getFolletoDetalle(id)
    if (!detalle) return NextResponse.json({ error: 'Esa solicitud de folletos no existe.' }, { status: 404 })
    return NextResponse.json(detalle)
  } catch (error) {
    reportarError('GET /api/studies/folletos/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH: cambio LIBRE de estado de un tiquete. Body: { status, nota? }.
 *
 * Por qué existe (FOL-2, 2026-10-05): el botón del lote solo avanza un paso,
 * así que un tiquete marcado «Enviado» por error se quedaba así para siempre.
 * Los errores de dedo existen y hay que poder devolver.
 *
 * Retroceder EXIGE nota, y todo cambio va al audit_log: dentro de un mes,
 * «¿por qué este tiquete volvió a Creada?» tiene que tener respuesta.
 *
 * NO re-dispara efectos: pasar a «Enviado» a mano no le reenvía el aviso al
 * dirigente. Ése es el único efecto que tiene la cadena —se censó— y
 * reenviarlo porque alguien corrigió un estado es escribirle dos veces a la
 * misma persona.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('folletos', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json().catch(() => null) as { status?: string; nota?: string } | null
    const status = body?.status
    const { isFolletoState, FOLLETO_STATE_LABEL } = await import('@/lib/studies/folletos')
    if (!status || !isFolletoState(status)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    }

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data: actual } = await createAdminClient()
      .from('folleto_requests').select('status').eq('id', id).maybeSingle()
    const desde = (actual as { status: string } | null)?.status
    if (!desde) return NextResponse.json({ error: 'Esa solicitud de folletos no existe.' }, { status: 404 })

    const { motivoQueImpide } = await import('@/lib/studies/cambio-de-estado-folleto')
    const impide = motivoQueImpide({ desde, hasta: status, nota: body?.nota })
    if (impide) return NextResponse.json({ error: impide, code: 'cambio_no_permitido' }, { status: 409 })

    const { setFolletoRequestsStatus } = await import('@/lib/supabase/queries/folletos')
    const { updated } = await setFolletoRequestsStatus([id], status, { libre: true })
    if (updated === 0) {
      return NextResponse.json({ error: 'No se pudo cambiar el estado.' }, { status: 409 })
    }

    const { logAudit } = await import('@/lib/audit')
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'folleto_requests',
      entityId: id,
      oldData: { status: desde },
      newData: { status, nota: body?.nota?.trim() || null },
    })

    return NextResponse.json({
      ok: true,
      status,
      mensaje: `El tiquete pasó a ${FOLLETO_STATE_LABEL[status]}.`,
    })
  } catch (error) {
    reportarError('PATCH /api/studies/folletos/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import {
  getSolicitudesDePuestos, ejecutarPublicacionMensual,
} from '@/lib/supabase/queries/servers'
import { planDePublicacion, hayAlgoQuePublicar } from '@/lib/servers/publicacion-mensual'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * SRV-12 · La publicación mensual.
 *
 * NO RECIBE LA LISTA DEL CLIENTE. La pantalla muestra el plan para que quien
 * confirma sepa qué va a pasar, pero el plan que se EJECUTA se recalcula acá
 * con la hora del servidor y el estado actual de la base: si viniera del
 * cliente, una pestaña abierta desde ayer podría bajar algo que se publicó hoy
 * o publicar una solicitud que mientras tanto se denegó.
 *
 * QUIÉN: la coordinación de servidores, admin y dirección. `solicitudes_puestos`
 * VE la pantalla y baja el Excel, pero NO publica — publicar baja lo que está
 * en la calle, y esa es una decisión de la coordinación.
 */
export async function POST() {
  try {
    const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
    if (auth.res) return auth.res

    const items = await getSolicitudesDePuestos()
    const ahora = new Date()
    const plan = planDePublicacion(
      items.map(i => ({ id: i.id, status: i.estado, published_at: i.published_at })),
      ahora,
    )

    if (!hayAlgoQuePublicar(plan)) {
      return NextResponse.json(
        { error: 'No hay nada que publicar ni que bajar.', code: 'nada_que_hacer' },
        { status: 409 },
      )
    }

    const r = await ejecutarPublicacionMensual(plan, ahora)

    // Queda firmado quién publicó y cuántos entraron y salieron. Cambia lo que
    // ve todo el mundo desde afuera y no tiene deshacer: sin registro,
    // «¿quién bajó los puestos?» no se contesta.
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'vacancies_publicacion_mensual',
      newData: {
        publicadas: r.publicadas,
        desactivadas: r.desactivadas,
        ids_publicados: plan.aPublicar,
        ids_desactivados: plan.aDesactivar,
      },
    })

    return NextResponse.json({ ok: true, ...r })
  } catch (error) {
    reportarError('POST /api/servers/vacancies/publish:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

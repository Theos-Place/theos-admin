import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  canManageCommittee, isGlobalServiceAdmin, puedeSolicitarParaCualquierComite,
} from '@/lib/auth/committee-scope'
import { createAdminClient } from '@/lib/supabase/admin'
import { createVacancyRequests, getServiceCoordinators } from '@/lib/supabase/queries/servers'
import { isVacancyRequestWindowOpen, motivoDeVentanaCerrada } from '@/lib/servers/request-window'
import { reportarError } from '@/lib/observabilidad'

/**
 * SRV-11 · El body es SOLO comité y cantidades.
 *
 * Los detalles de la vacante —horario, compromiso, ubicación, expiración,
 * destacada, notas— dejaron de pedirse: ya están en la ficha del puesto, y
 * pedirlos en cada solicitud producía tres versiones del mismo horario escritas
 * de memoria en meses distintos. Se siguen ACEPTANDO y se ignoran, para que una
 * pestaña vieja abierta no reviente con un 400 durante el despliegue.
 */
type Body = {
  committee_id?: string
  items?: Array<{ position_id?: string; quantity?: number }>
}

// POST: el líder de comité (o coordinación/admin) envía el "carrito" de cupos.
// Crea una vacante por puesto con slots_total = cantidad. Los roles
// administrativos globales (staff/coordinación) quedan aprobados y publicados
// de una; los líderes de comité quedan 'creado' (pendiente de revisión).
// Notifica al líder del comité (confirmación) y a los coordinadores (nueva solicitud).
export async function POST(req: NextRequest) {
  const auth = await requireRoles() // autenticado; el permiso real es por comité (abajo)
  if (auth.res) return auth.res
  try {
    const body = (await req.json()) as Body
    const committeeId = body.committee_id
    const items = (body.items ?? []).filter(i => i.position_id && Number(i.quantity) > 0) as Array<{ position_id: string; quantity: number }>

    if (!committeeId) return NextResponse.json({ error: 'Comité requerido.' }, { status: 400 })
    if (items.length === 0) return NextResponse.json({ error: 'Agregá al menos un cupo antes de enviar.' }, { status: 400 })

    // Permiso por comité: el líder solo el suyo; los roles globales y
    // `solicitudes_puestos` (SRV-11), cualquiera.
    if (!puedeSolicitarParaCualquierComite(auth.ctx.roles)
      && !(await canManageCommittee(auth.ctx.roles, auth.ctx.memberId, committeeId))) {
      return NextResponse.json({ error: 'No podés solicitar puestos para este comité.' }, { status: 403 })
    }

    // Ventana de tiempo. La excepción es SOLO para los roles administrativos
    // globales: `solicitudes_puestos` llena la solicitud en lugar del líder, y
    // una solicitud fuera de fecha sigue siendo fuera de fecha la mande quien
    // la mande. Server-side con la hora real, en zona America/Costa_Rica.
    const globalAdmin = isGlobalServiceAdmin(auth.ctx.roles)
    if (!globalAdmin && !isVacancyRequestWindowOpen()) {
      // El MISMO texto que ve en la pantalla: dos explicaciones distintas del
      // mismo cierre se leen como un bug.
      return NextResponse.json(
        { error: motivoDeVentanaCerrada(), code: 'ventana_cerrada' },
        { status: 403 },
      )
    }

    const { rows, slots, status } = await createVacancyRequests(committeeId, items, {
      schedule: null,
      commitment: null,
      location: null,
      notes: null,
      expires_at: null,
      is_featured: false,
    })
    if (rows === 0) {
      return NextResponse.json({ error: 'Ningún puesto válido para este comité.' }, { status: 400 })
    }

    // Notificaciones internas (best-effort, no bloquean la respuesta).
    try {
      const supabase = createAdminClient()
      const { data: committee } = await supabase
        .from('areas').select('name').eq('id', committeeId).maybeSingle()
      const com = committee as { name: string | null } | null
      const committeeName = com?.name ?? 'tu comité'
      // Les avisa a TODOS los encargados, no a uno solo: el comité puede tener
      // varios (Matrimonios tiene 4) y antes `areas.leader_id` guardaba uno
      // — cuando no coincidía con el del puesto, el aviso le llegaba a quien
      // ya no estaba a cargo (SRV-5, 2026-09-18).
      const { getEncargadosDeComite } = await import('@/lib/supabase/queries/servers')
      const encargados = await getEncargadosDeComite(committeeId)
      const link = '/servidores/vacantes/solicitudes'

      const notifs: Array<{ recipient_member_id: string; type: string; title: string; body: string; link: string }> = []

      // 1) Confirmación a los encargados del comité.
      for (const encargadoId of encargados) {
        notifs.push({
          recipient_member_id: encargadoId,
          type: 'vacancy_request_sent',
          title: 'Solicitud de puestos enviada',
          body: `${slots} cupo${slots !== 1 ? 's' : ''} solicitado${slots !== 1 ? 's' : ''} para ${committeeName}.`,
          link,
        })
      }
      // 2) Aviso a los coordinadores de servidores.
      const coords = await getServiceCoordinators()
      for (const c of coords) {
        notifs.push({
          recipient_member_id: c.member_id,
          type: 'vacancy_request_new',
          title: 'Nueva solicitud de puestos',
          body: `${committeeName}: ${slots} cupo${slots !== 1 ? 's' : ''} en ${rows} puesto${rows !== 1 ? 's' : ''}.`,
          link,
        })
      }
      // Dedup por destinatario (si el líder también es coordinador, no duplicar).
      const seen = new Set<string>()
      const deduped = notifs.filter(n => {
        const k = `${n.recipient_member_id}|${n.type}`
        if (seen.has(k)) return false
        seen.add(k); return true
      })
      if (deduped.length) await supabase.from('internal_notifications').insert(deduped)
    } catch (e) {
      console.warn('No se pudieron enviar las notificaciones de la solicitud de puestos:', e)
    }

    return NextResponse.json({ ok: true, rows, slots, status }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/servers/vacancies/request:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

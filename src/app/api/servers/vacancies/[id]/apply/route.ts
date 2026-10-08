import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { createApplication } from '@/lib/supabase/queries/servers'
import { ESTADO_PUBLICADO } from '@/lib/servers/publicacion-mensual'
import { reportarError } from '@/lib/observabilidad'

// POST: el usuario autenticado aplica a un puesto (como él mismo). Abierto a
// cualquier miembro. Solo puestos publicados; evita aplicaciones duplicadas.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles() // cualquier autenticado
  if (auth.res) return auth.res
  try {
    const memberId = auth.ctx.memberId
    if (!memberId) return NextResponse.json({ error: 'Tu sesión no tiene un perfil de miembro asociado.' }, { status: 400 })
    const { id } = await params
    const supabase = createAdminClient()

    const { data: vac } = await supabase.from('vacancies').select('status').eq('id', id).maybeSingle()
    const status = (vac as { status: string } | null)?.status
    if (!status) return NextResponse.json({ error: 'Puesto no encontrado' }, { status: 404 })
    // La constante y no el literal: esta línea comparaba contra 'aprobado',
    // que SRV-15 renombró, y desde entonces NADIE podía aplicar a nada — el
    // botón contestaba «este puesto no está disponible» para todos los
    // puestos publicados.
    if (status !== ESTADO_PUBLICADO) {
      return NextResponse.json({ error: 'Este puesto no está disponible para aplicar.' }, { status: 409 })
    }

    const { data: existing } = await supabase
      .from('applications').select('id').eq('vacancy_id', id).eq('applicant_id', memberId).maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'Ya aplicaste a este puesto.', code: 'already_applied' },
        { status: 409 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const { id: applicationId } = await createApplication({
      vacancy_id: id, applicant_id: memberId,
      notes: typeof body?.notes === 'string' ? body.notes : null,
    })

    /**
     * LOS DOS ACUSES (Floriana, 2026-10-08). Aplicar no mandaba NADA: ni la
     * persona sabía que su aplicación entró, ni el comité que había llegado
     * — el primer correo salía recién cuando alguien movía el estado a mano.
     *
     * BEST-EFFORT A PROPÓSITO, y envuelto entero: la aplicación ya está
     * guardada y es lo que vale. Si el correo falla, se pierde el correo, no
     * la aplicación — que es justo el orden contrario al que tendría si esto
     * pudiera tirar el request.
     */
    try {
      const { getDetalleDeAplicante } = await import('@/lib/supabase/queries/servers')
      const detalle = await getDetalleDeAplicante(applicationId)
      if (detalle) {
        const { notificarAlEncargado, notificarAcuseAlAplicante } =
          await import('@/lib/email/application-notify')
        await Promise.allSettled([
          notificarAcuseAlAplicante({
            correo: detalle.correo, nombre: detalle.nombre,
            puesto: detalle.puesto, comite: detalle.comite,
          }),
          notificarAlEncargado({
            committeeId: detalle.committee_id, detalle, momento: 'recibida',
          }),
        ])
      }
    } catch (e) {
      console.warn('acuses de aplicación recibida:', e)
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/servers/vacancies/[id]/apply:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

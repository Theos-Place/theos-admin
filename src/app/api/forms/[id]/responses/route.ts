import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, resolveTargetMemberId, getAuthContext } from '@/lib/auth/guard'
import { rateLimit } from '@/lib/rate-limit'
import {
  getFormResponses, submitResponse, hasMemberResponded, hasFormAccessGrant,
} from '@/lib/supabase/queries/forms'
import { formViewerScope, hasFormsModule } from '@/lib/auth/forms-scope'
import { memberFormFillAccess } from '@/lib/supabase/queries/form-fill-access'
import { isManagerOfFormEvent } from '@/lib/supabase/queries/events'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    // ?mine=1 → SOLO un booleano: ¿esta sesión ya respondió? Lo usa el llenado
    // para el dedupe (una respuesta por persona), así que lo puede consultar
    // cualquier sesión — no expone ninguna respuesta.
    if (req.nextUrl.searchParams.get('mine') === '1') {
      const self = await requireRoles()
      if (self.res) return self.res
      if (!self.ctx.memberId) return NextResponse.json({ answered: false })
      return NextResponse.json({ answered: await hasMemberResponded(id, self.ctx.memberId) })
    }
    // Las respuestas las lee el módulo formularios o quien tenga un acceso
    // puntual a ESTE formulario (form_access_grants). Regla pura: formViewerScope.
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const scope = formViewerScope({
      roles: ctx.roles,
      memberId: ctx.memberId,
      form: { id },
      hasGrant: await hasFormAccessGrant(id, ctx.memberId),
      // FRM-1 B: si el formulario cuelga de un evento, su encargado lo ve.
      isEventManager: await isManagerOfFormEvent(id, ctx.memberId),
    })
    if (scope === 'none') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    return NextResponse.json(await getFormResponses(id))
  } catch (error) {
    console.error('GET /api/forms/[id]/responses:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST: registra una respuesta. Body: { member_id?, guest_name?, guest_email?, answers }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Cualquier usuario con sesión puede responder un formulario; los de rol
    // siguen pudiendo hacerlo. Si algún día hay formularios públicos (invitados
    // sin sesión), este guard hay que repensarlo con rate limiting.
    const auth = await requireRoles()
    if (auth.res) return auth.res
    if (!rateLimit(`form-response:${auth.ctx.userId}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Demasiados envíos seguidos; esperá un minuto.' }, { status: 429 })
    }
    const { id } = await params
    const body = await req.json()

    // Anti-suplantación (auditoría S2): solo comunicaciones/dirección (y admin)
    // registran respuestas a nombre de OTRO miembro; el resto queda en su propio
    // perfil (o invitado si su sesión no tiene miembro vinculado).
    // El constraint response_member_or_guest exige member_id O guest_email.
    const memberId = resolveTargetMemberId(auth.ctx, body?.member_id, ['comunicaciones', 'direccion'])
    if (typeof body?.member_id === 'string' && body.member_id && body.member_id !== memberId) {
      return NextResponse.json(
        { error: 'No podés registrar respuestas a nombre de otro miembro' },
        { status: 403 },
      )
    }
    const guestEmail = typeof body?.guest_email === 'string' ? body.guest_email.trim() : ''
    if (!memberId && !EMAIL_RE.test(guestEmail)) {
      return NextResponse.json(
        { error: 'Se requiere un correo electrónico para enviar el formulario' },
        { status: 400 },
      )
    }

    // Solo puede enviar quien fue convocado (decisión 2026-08-06). Antes
    // alcanzaba con tener sesión y el link: alguien no recomendado podía
    // preinscribirse a CDEB igual. La regla vive en @/lib/forms/fill-access.
    const acceso = await memberFormFillAccess({
      formId: id,
      memberId,
      isStaff: hasFormsModule(auth.ctx.roles) || await hasFormAccessGrant(id, auth.ctx.memberId),
    })
    if (!acceso.allowed) {
      return NextResponse.json({ error: acceso.reason, code: 'formulario_no_asignado' }, { status: 403 })
    }

    const res = await submitResponse(id, { ...body, member_id: memberId, guest_email: memberId ? body.guest_email ?? null : guestEmail })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms/[id]/responses:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView, resolveTargetMemberId } from '@/lib/auth/guard'
import { rateLimit } from '@/lib/rate-limit'
import { getFormResponses, submitResponse } from '@/lib/supabase/queries/forms'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireModuleView('formularios')
    if (auth.res) return auth.res
    const { id } = await params
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

    const res = await submitResponse(id, { ...body, member_id: memberId, guest_email: memberId ? body.guest_email ?? null : guestEmail })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms/[id]/responses:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

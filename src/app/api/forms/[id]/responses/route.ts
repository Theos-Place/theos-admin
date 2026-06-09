import { NextRequest, NextResponse } from 'next/server'
import { getFormResponses, submitResponse } from '@/lib/supabase/queries/forms'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
    const { id } = await params
    const body = await req.json()

    // El constraint response_member_or_guest exige member_id O guest_email.
    // Si es invitado (sin member_id), el correo es obligatorio y con formato válido.
    // Lo validamos acá para nunca llegar a Supabase incumpliendo el constraint.
    const memberId = body?.member_id ?? null
    const guestEmail = typeof body?.guest_email === 'string' ? body.guest_email.trim() : ''
    if (!memberId && !EMAIL_RE.test(guestEmail)) {
      return NextResponse.json(
        { error: 'Se requiere un correo electrónico para enviar el formulario' },
        { status: 400 },
      )
    }

    const res = await submitResponse(id, { ...body, guest_email: memberId ? body.guest_email ?? null : guestEmail })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms/[id]/responses:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

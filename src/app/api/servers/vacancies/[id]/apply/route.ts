import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { createApplication } from '@/lib/supabase/queries/servers'

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
    if (status !== 'published') return NextResponse.json({ error: 'Este puesto no está disponible para aplicar.' }, { status: 409 })

    const { data: existing } = await supabase
      .from('applications').select('id').eq('vacancy_id', id).eq('applicant_id', memberId).maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'Ya aplicaste a este puesto.', code: 'already_applied' },
        { status: 409 },
      )
    }

    const body = await req.json().catch(() => ({}))
    await createApplication({ vacancy_id: id, applicant_id: memberId, notes: typeof body?.notes === 'string' ? body.notes : null })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/vacancies/[id]/apply:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

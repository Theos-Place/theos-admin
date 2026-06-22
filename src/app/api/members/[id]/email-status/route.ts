import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'

// Estado de comunicaciones por email de un miembro + acciones (suscribir,
// dar de baja, limpiar rebote/queja). Solo comunicaciones/direccion/admin.

type EmailStatusRow = {
  newsletter_opt_out: boolean | null
  newsletter_opt_out_at: string | null
  email_bounced: boolean | null
  email_bounced_at: string | null
  email_complained: boolean | null
  email_complained_at: string | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    // Columnas nuevas (mig. 085) aún no están en los tipos generados de Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const { data, error } = await supabase
      .from('members')
      .select('newsletter_opt_out, newsletter_opt_out_at, email_bounced, email_bounced_at, email_complained, email_complained_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const r = data as EmailStatusRow
    return NextResponse.json({
      subscribed: !r.newsletter_opt_out,
      opted_out_at: r.newsletter_opt_out_at,
      bounced: !!r.email_bounced,
      bounced_at: r.email_bounced_at,
      complained: !!r.email_complained,
      complained_at: r.email_complained_at,
    })
  } catch (error) {
    console.error('GET /api/members/[id]/email-status:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const { action } = (await req.json().catch(() => ({}))) as { action?: string }

    // Columnas nuevas (mig. 085) aún no están en los tipos generados de Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const now = new Date().toISOString()

    let patch: Record<string, unknown>
    if (action === 'subscribe') {
      patch = { newsletter_opt_out: false, newsletter_opt_out_at: null }
    } else if (action === 'unsubscribe') {
      patch = { newsletter_opt_out: true, newsletter_opt_out_at: now }
    } else if (action === 'clear_flags') {
      // Limpia rebote/queja para volver a habilitar el envío (falso positivo o
      // correo corregido). Afecta la reputación: la UI lo confirma antes.
      patch = { email_bounced: false, email_bounced_at: null, email_complained: false, email_complained_at: null }
    } else {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const { error } = await supabase.from('members').update(patch).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/[id]/email-status:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

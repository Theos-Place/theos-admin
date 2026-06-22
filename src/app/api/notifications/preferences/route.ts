import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

// Preferencias de notificación del miembro AUTENTICADO. Combina:
//  · member_notification_prefs (toggles internos + canal preferido)
//  · members.newsletter_opt_out (suscripción de marketing — fuente única)
//  · members.email_bounced / email_complained (bloquean re-suscripción)
// Solo el propio usuario lee/edita sus prefs (se usa ctx.memberId, nunca el body).

type Prefs = {
  recordatorios_eventos: boolean
  grupo_estudio: boolean
  mensajes_sistema: boolean
  canal_preferido: 'email' | 'whatsapp' | 'ambos'
}

const DEFAULTS: Prefs = {
  recordatorios_eventos: true,
  grupo_estudio: true,
  mensajes_sistema: true,
  canal_preferido: 'email',
}

const CANALES = ['email', 'whatsapp', 'ambos'] as const

export async function GET() {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const memberId = auth.ctx.memberId
  if (!memberId) return NextResponse.json({ error: 'Sin perfil de miembro' }, { status: 404 })
  try {
    // Columnas nuevas (mig. 085/089) aún no están en los tipos generados.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const [{ data: prefsRow }, { data: member }] = await Promise.all([
      supabase.from('member_notification_prefs')
        .select('recordatorios_eventos, grupo_estudio, mensajes_sistema, canal_preferido')
        .eq('member_id', memberId).maybeSingle(),
      supabase.from('members')
        .select('newsletter_opt_out, email_bounced, email_complained')
        .eq('id', memberId).maybeSingle(),
    ])
    const prefs: Prefs = prefsRow ? { ...DEFAULTS, ...prefsRow } : DEFAULTS
    return NextResponse.json({
      ...prefs,
      email_subscribed: !member?.newsletter_opt_out,
      email_bounced: !!member?.email_bounced,
      email_complained: !!member?.email_complained,
    })
  } catch (error) {
    console.error('GET /api/notifications/preferences:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const memberId = auth.ctx.memberId
  if (!memberId) return NextResponse.json({ error: 'Sin perfil de miembro' }, { status: 404 })
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Prefs> & { email_subscribed?: boolean }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any

    // 1) Toggles internos + canal → member_notification_prefs (upsert).
    const patch: Record<string, unknown> = { member_id: memberId, updated_at: new Date().toISOString() }
    if (typeof body.recordatorios_eventos === 'boolean') patch.recordatorios_eventos = body.recordatorios_eventos
    if (typeof body.grupo_estudio === 'boolean') patch.grupo_estudio = body.grupo_estudio
    if (typeof body.mensajes_sistema === 'boolean') patch.mensajes_sistema = body.mensajes_sistema
    if (typeof body.canal_preferido === 'string') {
      if (!CANALES.includes(body.canal_preferido as typeof CANALES[number])) {
        return NextResponse.json({ error: 'Canal inválido' }, { status: 400 })
      }
      patch.canal_preferido = body.canal_preferido
    }
    const { error: upErr } = await supabase
      .from('member_notification_prefs')
      .upsert(patch, { onConflict: 'member_id' })
    if (upErr) throw upErr

    // 2) Suscripción de marketing → members.newsletter_opt_out (fuente única).
    if (typeof body.email_subscribed === 'boolean') {
      const { data: m } = await supabase.from('members')
        .select('email_bounced, email_complained').eq('id', memberId).maybeSingle()
      const blocked = !!m?.email_bounced || !!m?.email_complained
      // Re-suscribir un correo con rebote/queja afecta la reputación: no se permite.
      if (body.email_subscribed && blocked) {
        return NextResponse.json({ error: 'EMAIL_BLOCKED' }, { status: 409 })
      }
      const optOut = !body.email_subscribed
      const { error: mErr } = await supabase.from('members')
        .update({ newsletter_opt_out: optOut, newsletter_opt_out_at: optOut ? new Date().toISOString() : null })
        .eq('id', memberId)
      if (mErr) throw mErr
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/notifications/preferences:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

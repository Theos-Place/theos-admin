import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getDailyEmailsSent } from '@/lib/supabase/queries/communications'
import { sendEmail, isEmailConfigured, DAILY_LIMIT, FROM_EMAIL } from '@/lib/email/provider'

// GET: estado de la integración de email (configurada, límite, uso de hoy).
export async function GET() {
  try {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
    return NextResponse.json({
      configured: isEmailConfigured(),
      fromEmail: FROM_EMAIL,
      dailyLimit: DAILY_LIMIT,
      sentToday: isEmailConfigured() ? await getDailyEmailsSent() : 0,
    })
  } catch (error) {
    console.error('GET /api/communications/email-status:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: envía un email de prueba a la cuenta del usuario autenticado.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'El proveedor de email (SES) no está configurado. Revisá las variables SES_* del servidor.' },
        { status: 400 },
      )
    }
    const { email } = (await req.json().catch(() => ({}))) as { email?: string }
    if (!email) return NextResponse.json({ error: 'Se requiere email' }, { status: 400 })

    await sendEmail({
      to: { email },
      subject: 'Email de prueba — Theos Admin',
      html: '<p>Este es un email de prueba del sistema de comunicaciones de Theos Place. Si lo recibiste, AWS SES está configurado correctamente. ✓</p>',
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/communications/email-status:', error)
    const msg = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: `No se pudo enviar: ${msg}` }, { status: 500 })
  }
}

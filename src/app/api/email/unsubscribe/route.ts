import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Baja de newsletter por link (sin login). El token (members.unsubscribe_token)
// identifica al miembro de forma estable y revocable.
//
// SEGURIDAD (excepción documentada al guard de AGENTS.md): endpoint PÚBLICO —
// el link va en el correo y el destinatario no tiene sesión. La autorización es
// el token único e impredecible; solo permite UNA acción (opt-out), nunca lee PII.
export const runtime = 'nodejs'

function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f6f6f9;margin:0;padding:48px 16px;color:#161440">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 32px rgba(22,20,64,.08);text-align:center">
    <h1 style="font-size:18px;margin:0 0 8px">${title}</h1>
    <p style="font-size:14px;color:#6b6b80;line-height:1.5;margin:0">${body}</p>
  </div>
</body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return page('Link inválido', 'El enlace de baja no es válido.')
  try {
    // Columnas nuevas (mig. 085) aún no están en los tipos generados de Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const { data, error } = await supabase
      .from('members')
      .update({ newsletter_opt_out: true, newsletter_opt_out_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      return page('Link inválido', 'No encontramos tu suscripción. Es posible que el enlace haya expirado.')
    }
    return page('Listo, te diste de baja', 'No vas a recibir más correos de newsletter/marketing de Theos Place. Los avisos importantes de tu cuenta seguirán llegando.')
  } catch (error) {
    console.error('GET /api/email/unsubscribe:', error)
    return page('Algo salió mal', 'No pudimos procesar tu baja. Intentá de nuevo más tarde.')
  }
}

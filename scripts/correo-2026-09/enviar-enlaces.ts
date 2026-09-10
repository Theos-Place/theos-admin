/**
 * Enlace de contraseña a Lisa y a Carlos (pedido por el usuario, 2026-09-10).
 *
 * Sale desde acá y no desde producción a propósito: así el correo se arma con
 * el arreglo del botón ya aplicado, sin esperar el deploy.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { patronDeCorreo } from '../../src/lib/email/correo-exacto'
import { sendPasswordLink } from '../../src/lib/auth/password-link'
import { isEmailSilentMode } from '../../src/lib/email/silent-mode'

const GENTE = ['lisavaldiviezo@hotmail.com', 'carlosgar_6@hotmail.com']

async function main() {
  if (isEmailSilentMode()) { console.log('EMAIL_SILENT_MODE activo: no saldría nada.'); process.exit(1) }
  const sb = createAdminClient()
  for (const correo of GENTE) {
    // Se manda al correo DE LA FICHA, nunca al escrito a mano: es la misma
    // regla del endpoint público y evita regalarle una cuenta a un tercero.
    const { data } = await sb.from('members')
      .select('id, first_name, last_name, email, auth_user_id')
      .ilike('email', patronDeCorreo(correo)).maybeSingle()
    const m = data as { first_name: string; last_name: string; email: string; auth_user_id: string | null } | null
    if (!m) { console.log(`✗ ${correo}: no hay ficha con ese correo`); continue }
    const res = await sendPasswordLink({
      email: m.email, tieneCuenta: !!m.auth_user_id, nombre: m.first_name,
    })
    console.log(`${res.sent ? '✓' : '✗'} ${m.first_name} ${m.last_name} <${m.email}> → ${res.sent ? `enviado (${res.kind})` : res.reason}`)
  }
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })

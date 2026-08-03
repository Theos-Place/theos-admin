import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'

// Enlace para definir o restablecer la contraseña, generado y enviado por
// NOSOTROS (2026-08-03).
//
// Antes esto lo hacía Supabase Auth: el navegador llamaba a
// resetPasswordForEmail y Supabase mandaba el correo. Dos problemas reales:
//
//  1. El flujo PKCE del cliente exige un `code_verifier` guardado en el MISMO
//     navegador donde se pidió el enlace. Quien pedía en la compu y abría el
//     correo en el celular veía "enlace inválido" con un token perfecto.
//  2. Ese correo sale por el SMTP de Supabase Auth, no por nuestro SES: otra
//     tubería que hay que configurar y vigilar aparte.
//
//  3. El token se gastaba solo: los filtros del correo (Safe Links de Microsoft
//     365) abren los enlaces antes que la persona para revisarlos.
//
// Ahora se genera el token con la API de admin (`generateLink`, que devuelve
// `hashed_token`) y se arma un enlace a /auth/continuar — una pantalla inofensiva
// con un botón; el canje real pasa en /auth/confirm cuando alguien lo toca, con
// verifyOtp y sin verifier. El correo sale por SES con la plantilla de Theos.

export type PasswordLinkKind = 'invite' | 'recovery'

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'

/** Genera el enlace propio (sin enviar nada). null si el correo no tiene cuenta. */
export async function buildPasswordLink(
  email: string,
  kind: PasswordLinkKind,
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.generateLink({
    type: kind === 'invite' ? 'invite' : 'recovery',
    email,
  })
  if (error || !data) return null
  const hashed = (data as { properties?: { hashed_token?: string }; hashed_token?: string })
    .properties?.hashed_token
    ?? (data as { hashed_token?: string }).hashed_token
  if (!hashed) return null

  const next = kind === 'invite' ? '/completar-perfil' : '/recuperar/nueva-contrasena'
  // /auth/continuar (no /auth/confirm): abrir esta URL NO gasta el token. Los
  // filtros de seguridad del correo abren los enlaces antes que la persona; si el
  // enlace canjeara de una, llegarían a "el enlace ya venció" sin tocar nada.
  const url = new URL('/auth/continuar', SITE())
  url.searchParams.set('token_hash', hashed)
  url.searchParams.set('type', kind === 'invite' ? 'invite' : 'recovery')
  url.searchParams.set('next', next)
  return url.toString()
}

function body(kind: PasswordLinkKind, link: string, nombre: string | null): string {
  const saludo = nombre ? `Hola, ${nombre}` : 'Hola'
  const intro = kind === 'invite'
    ? 'Tu cuenta del sistema de Theos Place ya está lista. Solo falta que definás tu contraseña.'
    : 'Pediste restablecer tu contraseña del sistema de Theos Place.'
  const cta = kind === 'invite' ? 'Definir mi contraseña →' : 'Cambiar mi contraseña →'
  return `<p class="greeting">${saludo}</p>

<p>${intro}</p>

<div class="cta-wrapper">
  <a class="cta-button" href="${link}">${cta}</a>
</div>

<div class="info-box">
  <p style="font-size:14px; color:#555; line-height:1.75; margin:0;">
    El enlace sirve <strong>una sola vez</strong> y vence en 24 horas. Podés abrirlo desde
    cualquier dispositivo: la compu, el celular, el que tengas a mano.
  </p>
</div>

<p style="font-size:13px; color:#777; line-height:1.7;">
  Si no pediste esto, podés ignorar el correo: tu contraseña no cambia hasta que abrás el
  enlace y definás una nueva.
</p>

<p style="font-size:13px; color:#777; line-height:1.7;">
  ¿Problemas para entrar? Escribinos a
  <a href="mailto:soporte@theosplace.org" style="color:#519DA2;">soporte@theosplace.org</a>.
</p>`
}

/** Manda el enlace por SES. `{ sent: false }` si el correo no tiene cuenta —
 *  el caller responde igual en los dos casos, para no revelar quién existe. */
export async function sendPasswordLink(input: {
  email: string
  kind: PasswordLinkKind
  nombre?: string | null
}): Promise<{ sent: boolean; reason?: string }> {
  const link = await buildPasswordLink(input.email, input.kind)
  if (!link) return { sent: false, reason: 'sin_cuenta' }
  try {
    await sendEmail({
      to: { email: input.email, name: input.nombre ?? input.email },
      subject: input.kind === 'invite'
        ? 'Definí tu contraseña de Theos Place'
        : 'Restablecé tu contraseña de Theos Place',
      html: renderEmail(body(input.kind, link, input.nombre ?? null)),
      // Transaccional: es un correo pedido por la persona, no una campaña.
      kind: 'transactional',
    })
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'error_envio' }
  }
}

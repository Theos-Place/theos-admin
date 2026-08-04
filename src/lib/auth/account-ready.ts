import 'server-only'
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'

/**
 * Correo de "tu cuenta ya está lista" — SIN token (2026-08-04).
 *
 * POR QUÉ SIN TOKEN: los enlaces de Supabase Auth vencen y sirven una sola vez.
 * Cuando el correo lo dispara un administrador, entre que se manda y la persona
 * lo abre pasan horas o días, y llegaba "el enlace ya no sirve". Como AUTH-1 ya
 * creó la cuenta de TODOS los miembros (18.101 usuarios de Auth con contraseña
 * aleatoria), no hace falta mandar un enlace con token: alcanza con decirle a la
 * persona que entre y toque "Creá tu contraseña acá". Ese enlace lo pide ella y
 * lo usa en segundos, así la expiración deja de importar.
 *
 * El correo CON token (password-link.ts) queda para el autoservicio: quien lo
 * pide, lo usa al toque.
 */

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'

/** URL de la pantalla de ingreso (sin token, sin parámetros). */
export function loginUrlFor(site = SITE()): string {
  return `${site}/login`
}

/**
 * Cuerpo del correo. Exportado para poder testear lo esencial: que NO lleva
 * ningún token — ni token_hash, ni /auth/continuar, ni /auth/confirm — sino el
 * link pelado al login y el paso a paso.
 */
export function accountReadyBody(nombre: string | null, loginUrl: string, correo: string): string {
  const saludo = nombre ? `Hola, ${nombre}` : 'Hola'
  return `<p class="greeting">${saludo}</p>

<p>Tu cuenta del sistema de Theos Place ya está lista. Para entrar por primera vez
solo tenés que crear tu contraseña — toma menos de dos minutos.</p>

<div class="cta-wrapper">
  <a class="cta-button" href="${loginUrl}">Entrar al sistema →</a>
</div>

<div class="info-box">
  <p class="info-title">Cómo crear tu contraseña</p>
  <p style="font-size:14px; color:#555; line-height:1.9; margin:0;">
    <strong>1.</strong> Abrí <a href="${loginUrl}" style="color:#519DA2;">${loginUrl.replace(/^https?:\/\//, '')}</a><br />
    <strong>2.</strong> Tocá <strong>&laquo;¿Primera vez en la nueva plataforma? Creá tu contraseña acá&raquo;</strong><br />
    <strong>3.</strong> Escribí tu correo: <strong>${correo}</strong><br />
    <strong>4.</strong> Te llega un enlace al momento; abrilo y definí tu contraseña.
  </p>
</div>

<p style="font-size:13px; color:#777; line-height:1.7;">
  Pedí ese enlace cuando vayás a usarlo: vence, así que lo mejor es hacer los cuatro
  pasos de una sentada. Podés hacerlo desde la compu o el celular, el que tengás a mano.
</p>

<p style="font-size:13px; color:#777; line-height:1.7;">
  ¿Problemas para entrar? Escribinos a
  <a href="mailto:soporte@theosplace.org" style="color:#519DA2;">soporte@theosplace.org</a>.
</p>`
}

/** Manda el aviso de cuenta lista (sin token). Best-effort: el caller decide
 *  qué hacer con `{ sent:false }`. */
export async function sendAccountReadyEmail(input: {
  email: string
  nombre?: string | null
}): Promise<{ sent: boolean; reason?: string }> {
  const loginUrl = loginUrlFor()
  try {
    await sendEmail({
      to: { email: input.email, name: input.nombre ?? input.email },
      subject: 'Tu cuenta de Theos Place ya está lista',
      html: renderEmail(accountReadyBody(input.nombre ?? null, loginUrl, input.email)),
      // Transaccional: es el aviso de acceso a su cuenta, no una campaña.
      kind: 'transactional',
    })
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'error_envio' }
  }
}

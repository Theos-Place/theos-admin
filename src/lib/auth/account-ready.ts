import 'server-only'
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'

/**
 * Correos de acceso que manda un ADMINISTRADOR — SIN token (2026-08-04).
 *
 * POR QUÉ SIN TOKEN: los enlaces de Supabase Auth vencen (máximo 24 h en el
 * dashboard; hoy 2 h) y sirven una sola vez. Cuando el correo lo dispara un
 * administrador, entre que se manda y la persona lo abre pasan horas o días y
 * llegaba muerto — o lo consumía antes un escáner de enlaces del correo
 * corporativo. Como AUTH-1 ya creó la cuenta de todos los miembros, no hace
 * falta mandar el enlace: alcanza con decirle a la persona cómo pedirlo ella
 * misma desde la pantalla de ingreso, y ahí lo usa en segundos.
 *
 * Dos variantes, misma estructura:
 *   · 'primera_vez'  → nunca ha entrado.
 *   · 'restablecer'  → ya tenía contraseña y la perdió.
 *
 * Las dos apuntan al MISMO enlace de la pantalla de ingreso: desde el
 * 2026-09-01 hay uno solo, "Restablecé tu contraseña", porque los dos casos
 * siempre fueron el mismo flujo. Lo que cambia entre las variantes es el tono,
 * no el camino.
 *
 * El correo CON token (password-link.ts) queda SOLO para el autoservicio: ahí
 * lo pide la persona y lo usa al toque.
 */

export type AccessEmailKind = 'primera_vez' | 'restablecer'

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'

/** URL de la pantalla de ingreso (sin token, sin parámetros). */
export function loginUrlFor(site = SITE()): string {
  return `${site}/login`
}

const COPY: Record<AccessEmailKind, {
  subject: string
  intro: string
  cta: string
  pasosTitulo: string
  enlaceDeLogin: string
  ultimoPaso: string
}> = {
  primera_vez: {
    subject: 'Tu cuenta de Theos Place ya está lista',
    intro: 'Tu cuenta del sistema de Theos Place ya está lista. Para entrar por primera vez '
      + 'solo tenés que crear tu contraseña — toma menos de dos minutos.',
    cta: 'Entrar al sistema →',
    pasosTitulo: 'Cómo crear tu contraseña',
    enlaceDeLogin: '&laquo;¿Primera vez en la nueva plataforma u olvidaste tu contraseña? Restablecé tu contraseña&raquo;',
    ultimoPaso: 'Te llega un enlace al momento; abrilo y definí tu contraseña.',
  },
  restablecer: {
    subject: 'Cómo recuperar el acceso a tu cuenta de Theos Place',
    intro: 'Para volver a entrar al sistema de Theos Place tenés que definir una contraseña '
      + 'nueva. Son cuatro pasos y no toma ni dos minutos.',
    cta: 'Ir a la pantalla de ingreso →',
    pasosTitulo: 'Cómo recuperar tu acceso',
    enlaceDeLogin: '&laquo;¿Primera vez en la nueva plataforma u olvidaste tu contraseña? Restablecé tu contraseña&raquo;',
    ultimoPaso: 'Te llega un enlace al momento; abrilo y definí tu contraseña nueva.',
  },
}

/**
 * Cuerpo del correo. Exportado para poder testear lo esencial: que NO lleva
 * ningún token — ni token_hash, ni /auth/continuar, ni /auth/confirm — sino el
 * link pelado al login y el paso a paso.
 */
export function accountReadyBody(
  nombre: string | null,
  loginUrl: string,
  correo: string,
  kind: AccessEmailKind = 'primera_vez',
): string {
  const saludo = nombre ? `Hola, ${nombre}` : 'Hola'
  const t = COPY[kind]
  return `<p class="greeting">${saludo}</p>

<p>${t.intro}</p>

<div class="cta-wrapper">
  <a class="cta-button" href="${loginUrl}">${t.cta}</a>
</div>

<div class="info-box">
  <p class="info-title">${t.pasosTitulo}</p>
  <p style="font-size:14px; color:#555; line-height:1.9; margin:0;">
    <strong>1.</strong> Abrí <a href="${loginUrl}" style="color:#3B7579;">${loginUrl.replace(/^https?:\/\//, '')}</a><br />
    <strong>2.</strong> Tocá <strong>${t.enlaceDeLogin}</strong><br />
    <strong>3.</strong> Escribí tu correo: <strong>${correo}</strong><br />
    <strong>4.</strong> ${t.ultimoPaso}
  </p>
</div>

<p style="font-size:13px; color:#777; line-height:1.7;">
  Pedí ese enlace cuando vayás a usarlo: vence, así que lo mejor es hacer los cuatro
  pasos de una sentada. Podés hacerlo desde la compu o el celular, el que tengás a mano.
</p>

<p style="font-size:13px; color:#777; line-height:1.7;">
  ¿Problemas para entrar? Escribinos a
  <a href="mailto:soporte@theosplace.org" style="color:#3B7579;">soporte@theosplace.org</a>.
</p>`
}

/** Manda las instrucciones de acceso (sin token). Best-effort: el caller decide
 *  qué hacer con `{ sent:false }`. */
export async function sendAccountReadyEmail(input: {
  email: string
  nombre?: string | null
  /** 'primera_vez' (default) o 'restablecer'. */
  kind?: AccessEmailKind
}): Promise<{ sent: boolean; reason?: string }> {
  const loginUrl = loginUrlFor()
  const kind = input.kind ?? 'primera_vez'
  try {
    await sendEmail({
      to: { email: input.email, name: input.nombre ?? input.email },
      subject: COPY[kind].subject,
      html: renderEmail(accountReadyBody(input.nombre ?? null, loginUrl, input.email, kind)),
      // Transaccional: es el aviso de acceso a su cuenta, no una campaña.
      kind: 'transactional',
      // Sale IGUAL con el modo silencioso (MIG-1 Etapa 0). Sus dos callers son
      // botones del staff para UN miembro (/password-reset y
      // /resend-activation): nada masivo ni automático.
      authCritical: true,
    })
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'error_envio' }
  }
}

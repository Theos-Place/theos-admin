/**
 * Proveedor de email del sistema: AWS SES vía SMTP (nodemailer, STARTTLS:587).
 * Interfaz provider-neutral — el resto del sistema solo conoce sendEmail()/
 * isEmailConfigured(); cambiar de proveedor no toca la cola ni los broadcasts.
 *
 * Variables de entorno (Vercel + Supabase Edge Function):
 *   SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD,
 *   SES_FROM_EMAIL (no-reply@theosplace.org), SES_FROM_NAME (Theos Place)
 *
 * Solo server-side (usa nodemailer). Nunca importar desde el cliente.
 */
import nodemailer from 'nodemailer'
import { listUnsubscribeHeader } from '@/lib/email/footer'
import { providerMessageId } from '@/lib/email/ses-message-id'

/** Token de error cuando no hay proveedor configurado (la UI lo traduce). */
export const EMAIL_NOT_CONFIGURED = 'EMAIL_NOT_CONFIGURED'

/** Techo diario de envío para la cola/rate-limiting (configurable). */
export const DAILY_LIMIT = Number(process.env.EMAIL_DAILY_LIMIT ?? 5000)

const SES_VARS = [
  'SES_SMTP_HOST', 'SES_SMTP_PORT', 'SES_SMTP_USER', 'SES_SMTP_PASSWORD',
  'SES_FROM_EMAIL', 'SES_FROM_NAME',
] as const

/** Variables SES que faltan (vacío = todo configurado). */
function missingSesVars(): string[] {
  return SES_VARS.filter(v => !process.env[v])
}

/** ¿Está el proveedor de email (SES) completamente configurado? */
export function isEmailConfigured(): boolean {
  return missingSesVars().length === 0
}

/** Lanza un error explícito si falta alguna variable SES (no fallar en silencio). */
export function assertEmailConfigured(): void {
  const missing = missingSesVars()
  if (missing.length > 0) {
    throw new Error(`${EMAIL_NOT_CONFIGURED}: faltan variables de entorno SES (${missing.join(', ')})`)
  }
}

export const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'no-reply@theosplace.org'
export const FROM_NAME = process.env.SES_FROM_NAME ?? 'Theos Place'

// Configuration Set de SES: necesario para que SES dispare las notificaciones de
// bounce/complaint a SNS. Sin este header (y sin el config set con event
// destination en AWS), el webhook nunca recibe eventos. SIEMPRE debe ir en cada
// correo; el env solo permite apuntar a otro config set. Default: 'theos-default'.
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || 'theos-default'

let _transport: nodemailer.Transporter | null = null
function getTransport(): nodemailer.Transporter {
  if (_transport) return _transport
  assertEmailConfigured()
  _transport = nodemailer.createTransport({
    host: process.env.SES_SMTP_HOST,
    port: Number(process.env.SES_SMTP_PORT ?? 587),
    secure: false,        // 587 = STARTTLS (se promueve a TLS tras EHLO)
    requireTLS: true,
    auth: {
      user: process.env.SES_SMTP_USER,
      pass: process.env.SES_SMTP_PASSWORD,
    },
    // Timeouts explícitos (auditoría A7): los defaults de nodemailer son 2 min
    // de conexión y 10 min de socket — un SMTP colgado congelaba la función
    // serverless (y al usuario) hasta que Vercel la matara.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
  return _transport
}

export type SendEmailInput = {
  to: { email: string; name?: string }
  subject: string
  html: string
  /** SES exige un remitente verificado; por defecto usa SES_FROM_*. Estos campos
   *  se aceptan por compatibilidad pero el remitente real siempre es el verificado. */
  fromName?: string
  fromEmail?: string
  /** Tipo de correo. 'marketing' inyecta el pie de baja + header List-Unsubscribe
   *  (requiere unsubscribeToken). 'transactional' (default) no lleva pie. */
  kind?: 'marketing' | 'transactional'
  /** Token de baja del destinatario. Sin él, aunque sea marketing, no se inyecta
   *  pie (no podríamos generar el link de baja). */
  unsubscribeToken?: string
  /** Headers extra. El config set y el List-Unsubscribe los maneja el helper. */
  headers?: Record<string, string>
}

/**
 * Envía un email por SES SMTP. Centraliza la config de SES:
 *  - X-SES-CONFIGURATION-SET en TODOS los envíos (bounces/complaints → SNS).
 *  - header List-Unsubscribe en marketing (con token).
 * El `html` ya viene ENVUELTO en el layout base (renderEmail) por el caller, con
 * el pie de baja dentro cuando es marketing — acá NO se modifica el HTML.
 * El remitente es siempre SES_FROM_EMAIL (verificado).
 */
export async function sendEmail({ to, subject, html, fromName, kind, unsubscribeToken, headers }: SendEmailInput): Promise<{ messageId: string }> {
  assertEmailConfigured()
  const marketingHeaders = kind === 'marketing' && unsubscribeToken ? listUnsubscribeHeader(unsubscribeToken) : undefined
  const transport = getTransport()
  const result = await transport.sendMail({
    from: { name: fromName || FROM_NAME, address: FROM_EMAIL },
    to: to.name ? { name: to.name, address: to.email } : to.email,
    subject,
    html,
    headers: {
      'X-SES-CONFIGURATION-SET': CONFIGURATION_SET, // siempre: sin esto SES no publica bounces/complaints a SNS
      ...marketingHeaders,
      ...headers,
    },
  })
  // El ID de SES, no el Message-ID que generó nodemailer: es el que llega en los
  // eventos de SNS, así que es el único que empareja entregas y rebotes con su
  // envío. Ver ses-message-id.ts.
  return { messageId: providerMessageId(result.response, result.messageId) }
}

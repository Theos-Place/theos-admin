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
import { isEmailSilentMode, silentDecision, silentLogLine } from '@/lib/email/silent-mode'

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
  /** MIG-1 Etapa 0: este correo sale IGUAL con el modo silencioso encendido.
   *  Solo para los correos de ACCESO (definir/restablecer contraseña, reenviar
   *  activación): sin ellos el staff no puede entrar a trabajar, y no los
   *  dispara ningún cron ni ningún import. `grep authCritical` lista la
   *  excepción completa — no agregar nada acá sin pensarlo dos veces. */
  authCritical?: boolean
}

/** Deja constancia de lo que el modo silencioso no envió. Best-effort y con
 *  import dinámico: provider.ts lo usan rutas donde no queremos arrastrar el
 *  cliente de Supabase si el modo está apagado (el caso normal). */
async function registrarSilenciado(to: string, subject: string, kind?: string): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    await createAdminClient().from('silenced_emails').insert({
      recipient: to, subject, kind: kind ?? null,
    })
  } catch (e) {
    // Que falle el registro no puede convertirse en un envío: el correo YA no
    // se mandó. Solo se pierde la línea del reporte.
    console.warn('registrarSilenciado:', e instanceof Error ? e.message : e)
  }
}


/**
 * Deja constancia de CADA correo que sale por acá.
 *
 * Antes solo se registraban las campañas: los transaccionales —el enlace de
 * contraseña, el aviso de cobro, el recordatorio de cierre— no dejaban rastro.
 * Tres veces en una semana hubo que contestar "¿le llegó el correo?" por
 * deducción, mirando `recovery_sent_at` de Auth y descartando causas, en vez de
 * mirarlo. Casos: Adriana Jiménez, Douglas García y Arianna Leiva.
 *
 * `broadcast_id` queda NULO, y eso es lo que distingue un transaccional de una
 * campaña. La fila se empareja después con los eventos de SES por
 * `provider_message_id`, así que las entregas y los rebotes de estos correos se
 * anotan solos con el código que ya existe.
 *
 * Best-effort y con import dinámico, igual que registrarSilenciado: si falla el
 * registro NO se cae el envío. El correo ya salió; perder la línea del log es
 * molesto, no romper el envío por escribirlo sería peor.
 *
 * OJO con un efecto de borde deseado: getDailyEmailsSent() cuenta message_logs
 * sin filtrar por campaña, así que ahora los transaccionales también cuentan
 * para el límite diario. Es lo correcto —consumen la misma cuota de SES— y el
 * volumen es bajo, pero conviene saberlo si un día una campaña se reparte en
 * más días de los esperados.
 */
async function registrarEnvio(input: {
  to: string; subject: string; status: 'sent' | 'failed'
  messageId?: string; error?: string
}): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    // Cliente laxo: `subject` es una columna nueva (migración 20260901120000) y
    // los tipos generados todavía no la traen. Mismo patrón que en
    // members-detail.ts con las columnas nuevas de payments.
    const db = createAdminClient() as unknown as {
      from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: unknown }> }
    }
    await db.from('message_logs').insert({
      channel: 'email',
      recipient: input.to,
      subject: input.subject,
      status: input.status,
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
      provider_message_id: input.messageId ?? null,
      last_error: input.error ?? null,
    })
  } catch (e) {
    console.warn('registrarEnvio:', e instanceof Error ? e.message : e)
  }
}

/**
 * Envía un email por SES SMTP. Centraliza la config de SES:
 *  - X-SES-CONFIGURATION-SET en TODOS los envíos (bounces/complaints → SNS).
 *  - header List-Unsubscribe en marketing (con token).
 * El `html` ya viene ENVUELTO en el layout base (renderEmail) por el caller, con
 * el pie de baja dentro cuando es marketing — acá NO se modifica el HTML.
 * El remitente es siempre SES_FROM_EMAIL (verificado).
 */
export async function sendEmail({ to, subject, html, fromName, kind, unsubscribeToken, headers, authCritical }: SendEmailInput): Promise<{ messageId: string }> {
  // Dominios .invalid (cuentas [prueba] del seed): jamás se intenta enviar —
  // cada intento rebota en SES y castiga la reputación del remitente. Los
  // tutoriales grabados y las corridas de QA matriculan con estas cuentas.
  if (/\.invalid$/i.test(to.email.trim())) {
    console.warn(`sendEmail omitido (dominio .invalid): ${to.email}`)
    return { messageId: 'skipped-invalid-domain' }
  }
  // MIG-1 Etapa 0 · Modo silencioso. Va ANTES de assertEmailConfigured a
  // propósito: con el modo encendido el correo no sale, así que no importa si
  // SES está configurado — y así el modo también sirve en local sin SES.
  if (silentDecision({ silent: isEmailSilentMode(), authCritical }) === 'silenciar') {
    console.warn(silentLogLine(to.email, subject))
    await registrarSilenciado(to.email, subject, kind)
    return { messageId: 'skipped-silent-mode' }
  }

  assertEmailConfigured()
  const marketingHeaders = kind === 'marketing' && unsubscribeToken ? listUnsubscribeHeader(unsubscribeToken) : undefined
  const transport = getTransport()
  let result: Awaited<ReturnType<typeof transport.sendMail>>
  try {
    result = await transport.sendMail({
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
  } catch (e) {
    // Un envío que ni siquiera salió también es información: sin esta línea,
    // "no me llegó el correo" y "el correo nunca se mandó" se ven igual desde
    // afuera.
    await registrarEnvio({ to: to.email, subject, status: 'failed', error: e instanceof Error ? e.message : String(e) })
    throw e
  }
  // El ID de SES, no el Message-ID que generó nodemailer: es el que llega en los
  // eventos de SNS, así que es el único que empareja entregas y rebotes con su
  // envío. Ver ses-message-id.ts.
  const messageId = providerMessageId(result.response, result.messageId)
  await registrarEnvio({ to: to.email, subject, status: 'sent', messageId })
  return { messageId }
}

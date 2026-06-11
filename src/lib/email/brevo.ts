/**
 * Cliente de Brevo para email transaccional (SDK v5). Solo server-side.
 * La API key vive en BREVO_API_KEY (env) — nunca en la BD.
 * Free tier: 300 emails/día; usamos BREVO_DAILY_LIMIT (default 280) como techo.
 */
import { BrevoClient } from '@getbrevo/brevo'

export const DAILY_LIMIT = Number(process.env.BREVO_DAILY_LIMIT ?? 280)

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY)
}

export async function sendEmail({
  to,
  fromName,
  fromEmail,
  subject,
  html,
}: {
  to: { email: string; name?: string }
  fromName: string
  fromEmail: string
  subject: string
  html: string
}): Promise<{ messageId: string }> {
  if (!isBrevoConfigured()) {
    throw new Error('BREVO_API_KEY no está configurada')
  }
  const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY! })
  const result = await client.transactionalEmails.sendTransacEmail({
    to: [to],
    sender: { name: fromName, email: fromEmail },
    subject,
    htmlContent: html,
  })
  return { messageId: result.messageId ?? '' }
}

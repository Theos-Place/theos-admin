/**
 * Envía UN correo de prueba para ver el render real (layout base + contenido de
 * una plantilla del sistema con datos de ejemplo). Uso:
 *   npx tsx scripts/send-test-email.ts [correo] [system_key]
 * Default: ti@theosplace.org, matricula_estudiante.
 */
import nodemailer from 'nodemailer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { renderEmail } from '../src/lib/email/baseLayout'
import { renderTemplate, PREVIEW_SAMPLE } from '../src/lib/email/render-vars'

for (const file of ['.env', '.env.local']) {
  try {
    const t = readFileSync(join(process.cwd(), file), 'utf8')
    for (const line of t.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sigue */ }
}

const to = process.argv[2] || 'ti@theosplace.org'
const key = process.argv[3] || 'matricula_estudiante'
// 3er arg 'marketing' → envuelve con el pie de baja (para revisar el footer).
const asMarketing = process.argv[4] === 'marketing'

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } },
  )
  const { data, error } = await supabase
    .from('message_templates').select('subject, body').eq('system_key', key).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No existe la plantilla del sistema '${key}'`)

  const subject = `[PRUEBA${asMarketing ? ' MKT' : ''}] ${renderTemplate(data.subject ?? 'Theos Place', PREVIEW_SAMPLE)}`
  const html = renderEmail(
    renderTemplate(data.body, PREVIEW_SAMPLE),
    asMarketing ? { unsubscribeUrl: 'https://admin.theosplace.org/api/email/unsubscribe?token=demo' } : undefined,
  )

  const transport = nodemailer.createTransport({
    host: process.env.SES_SMTP_HOST,
    port: Number(process.env.SES_SMTP_PORT ?? 587),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SES_SMTP_USER, pass: process.env.SES_SMTP_PASSWORD },
  })
  const res = await transport.sendMail({
    from: { name: process.env.SES_FROM_NAME || 'Theos Place', address: process.env.SES_FROM_EMAIL! },
    to,
    subject,
    html,
    headers: { 'X-SES-CONFIGURATION-SET': process.env.SES_CONFIGURATION_SET || 'theos-default' },
  })
  console.log(`Enviado a ${to} (plantilla '${key}'). messageId: ${res.messageId}`)
}

run().catch(e => { console.error(e); process.exit(1) })

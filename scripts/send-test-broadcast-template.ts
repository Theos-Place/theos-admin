/**
 * Envía correos de PRUEBA de plantillas NO del sistema (las de /comunicaciones,
 * que se buscan por nombre y usan {nombre}). Render idéntico al envío real:
 * applyVars → renderEmail (header navy + logo + footer).
 *
 * Uso:
 *   npx tsx scripts/send-test-broadcast-template.ts "correo1,correo2" "Nombre plantilla" ["Otra plantilla" ...]
 *
 * Ejemplo (las tres invitaciones a estudios):
 *   npx tsx scripts/send-test-broadcast-template.ts "ti@theosplace.org,estudios@theosplace.org" \
 *     "Invitación a Nivel 1 / Capacitaciones" "Invitación seleccionados CDEB" "Invitación seleccionados Hermenéutica"
 */
import nodemailer from 'nodemailer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { renderEmail } from '../src/lib/email/baseLayout'
import { applyVars } from '../src/lib/communications/vars'

for (const file of ['.env', '.env.local']) {
  try {
    const t = readFileSync(join(process.cwd(), file), 'utf8')
    for (const line of t.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sigue */ }
}

const recipients = (process.argv[2] ?? 'ti@theosplace.org').split(',').map(s => s.trim()).filter(Boolean)
const names = process.argv.slice(3)

async function run() {
  if (names.length === 0) throw new Error('Pasá al menos un nombre de plantilla')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } },
  )

  const transport = nodemailer.createTransport({
    host: process.env.SES_SMTP_HOST,
    port: Number(process.env.SES_SMTP_PORT ?? 587),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SES_SMTP_USER, pass: process.env.SES_SMTP_PASSWORD },
  })

  for (const name of names) {
    const { data, error } = await supabase
      .from('message_templates').select('subject, body').eq('name', name).maybeSingle()
    if (error) throw error
    if (!data) { console.warn(`SIN PLANTILLA: "${name}"`); continue }

    // {nombre} lo aplica el envío real; {link_formulario} lo inyecta la pantalla
    // de selección — acá se sustituye por el link de ejemplo para que el botón
    // del correo de prueba no quede vacío.
    const body = applyVars(data.body, { nombre: 'Floriana' })
      .split('{link_formulario}').join('https://admin.theosplace.org/formularios/ejemplo/responder')
    const html = renderEmail(body)
    const subject = `[PRUEBA] ${applyVars(data.subject ?? 'Theos Place', { nombre: 'Floriana' })}`

    for (const to of recipients) {
      const res = await transport.sendMail({
        from: { name: process.env.SES_FROM_NAME || 'Theos Place', address: process.env.SES_FROM_EMAIL! },
        to,
        subject,
        html,
        headers: { 'X-SES-CONFIGURATION-SET': process.env.SES_CONFIGURATION_SET || 'theos-default' },
      })
      console.log(`✓ "${name}" → ${to} (${res.messageId})`)
    }
  }
}

run().catch(e => { console.error(e); process.exit(1) })

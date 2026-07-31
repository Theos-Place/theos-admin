/**
 * Prueba el PIPELINE REAL de comunicaciones (no un envío suelto por SMTP):
 * createBroadcast → sendBroadcast → filtro de bajas/rebotes → cola de
 * message_logs → processPendingEmails → SES, con sus contadores.
 *
 * Uso (OJO con NODE_OPTIONS: los módulos de queries hacen `import 'server-only'`,
 * que revienta en tsx sin la condición react-server):
 *   NODE_OPTIONS="--conditions=react-server" \
 *     npx tsx scripts/send-test-broadcast-real.ts "Nombre de la plantilla" correo1[,correo2]
 *
 * Los destinatarios se resuelven a MIEMBROS por correo: si el correo no está en
 * members, no se puede enviar por este camino (el broadcast encola por member).
 * El tipo de correo lo infiere inferEmailKind desde la plantilla, igual que la
 * pantalla de redacción.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

for (const file of ['.env', '.env.local']) {
  try {
    const t = readFileSync(join(process.cwd(), file), 'utf8')
    for (const line of t.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sigue */ }
}

async function main() {
  // Import diferido: los módulos de queries hacen `import 'server-only'`, que
  // revienta si se resuelve antes de tener el entorno cargado.
  const { createAdminClient } = await import('../src/lib/supabase/admin')
  const { createBroadcast, sendBroadcast, getBroadcastQueueStats } =
    await import('../src/lib/supabase/queries/communications')
  const { inferEmailKind } = await import('../src/lib/communications/email-kind')
  const { FORM_LINK_TOKEN } = await import('../src/lib/supabase/queries/form-selection')

  const templateName = process.argv[2]
  const emails = (process.argv[3] ?? 'ti@theosplace.org').split(',').map(s => s.trim().toLowerCase())
  if (!templateName) throw new Error('Falta el nombre de la plantilla')

  const db = createAdminClient()

  const { data: tpl } = await db
    .from('message_templates')
    .select('id, name, subject, body, body_format, category, system_key')
    .eq('name', templateName)
    .maybeSingle()
  if (!tpl) throw new Error(`No existe la plantilla "${templateName}"`)
  const t = tpl as {
    id: string; name: string; subject: string | null; body: string
    body_format: string | null; category: string | null; system_key: string | null
  }

  const { data: mem } = await db
    .from('members').select('id, first_name, last_name, email').in('email', emails)
  const members = (mem ?? []) as Array<{ id: string; first_name: string; last_name: string; email: string }>
  const faltan = emails.filter(e => !members.some(m => m.email.toLowerCase() === e))
  if (faltan.length) console.warn(`SIN MIEMBRO (se omiten): ${faltan.join(', ')}`)
  if (members.length === 0) throw new Error('Ningún correo corresponde a un miembro')

  const kind = inferEmailKind({ is_system: !!t.system_key, category: t.category })
  // La convocatoria lleva el token del link; acá se apunta al formulario real
  // de preinscripción si existe, o a un link de ejemplo.
  const { data: form } = await db
    .from('forms').select('id').ilike('title', 'Preinscripción%').limit(1).maybeSingle()
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
  const link = form ? `${site}/formularios/${(form as { id: string }).id}/responder` : `${site}/formularios`
  const body = t.body.split(FORM_LINK_TOKEN).join(link)

  console.log(`Plantilla: "${t.name}" · categoría ${t.category ?? '—'} → tipo ${kind}`)
  console.log(`Destinatarios: ${members.map(m => m.email).join(', ')}`)
  console.log(`Link del formulario: ${link}`)

  const { id } = await createBroadcast({
    template_id: t.id,
    channel: 'email',
    kind,
    subject: `[PRUEBA] ${t.subject ?? 'Theos Place'}`,
    body,
    body_format: (t.body_format as 'text' | 'html' | null) ?? 'html',
    segment_label: `Prueba · ${t.name}`,
    total_recipients: members.length,
  })
  console.log(`Broadcast ${id} creado. Enviando…`)

  await sendBroadcast(id, members.map(m => ({ member_id: m.id, channel: 'email' as const, recipient: '' })))

  const stats = await getBroadcastQueueStats(id)
  const { data: after } = await db
    .from('message_broadcasts')
    .select('status, sent_count, failed_count, skipped_count, total_recipients')
    .eq('id', id).single()
  console.log('Resultado:', JSON.stringify(after), 'cola:', JSON.stringify(stats))

  const { data: logs } = await db
    .from('message_logs').select('recipient, status, last_error').eq('broadcast_id', id)
  for (const l of (logs ?? []) as Array<{ recipient: string; status: string; last_error: string | null }>) {
    console.log(`  · ${l.recipient} → ${l.status}${l.last_error ? ` (${l.last_error})` : ''}`)
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })

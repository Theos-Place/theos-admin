/**
 * Comunicado «Mañana hay charla: ¿Podemos confiar en la Biblia?» a los 1.300
 * asistentes de Meridiano Martes en 2026.
 *   npx tsx --env-file=.env.local scripts/meridiano-2026-09-14/enviar.cjs [--aplicar]
 *
 * Usa createBroadcast + sendBroadcast del propio sistema (no SQL a mano) para
 * que respete opt-out, rebotes, el límite diario y quede en el historial de
 * comunicaciones como cualquier otro envío.
 */
const LISTA = '8ee81c0d-0b91-4283-b95d-4bf4f10fec04'
const PLANTILLA = '65ea8170-5410-4048-8cec-85186d566466'
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const { createAdminClient } = await import('../../src/lib/supabase/admin.ts')
  const q = await import('../../src/lib/supabase/queries/communications.ts')
  const { DAILY_LIMIT } = await import('../../src/lib/email/provider.ts')
  const db = createAdminClient()

  const { data: lista } = await db.from('member_lists').select('name, member_ids').eq('id', LISTA).single()
  const ids = lista.member_ids
  const { data: tpl } = await db.from('message_templates').select('subject, body').eq('id', PLANTILLA).single()
  const usadosHoy = await q.getDailyEmailsSent()

  console.log(`lista: «${lista.name}» — ${ids.length} personas`)
  console.log(`asunto: ${tpl.subject}`)
  console.log(`enviados hoy: ${usadosHoy} / ${DAILY_LIMIT}  → caben hoy: ${Math.max(0, DAILY_LIMIT - usadosHoy)}`)
  console.log(`silent mode: ${process.env.EMAIL_SILENT_MODE || '(apagado)'}`)
  if (!aplicar) { console.log('\n🔎 DRY RUN — no se creó ni se envió nada.'); return }

  const { id } = await q.createBroadcast({
    template_id: PLANTILLA, channel: 'email', kind: 'marketing',
    subject: tpl.subject, body: tpl.body, body_format: 'html',
    segment_label: lista.name, total_recipients: ids.length,
  })
  console.log(`\nborrador creado: ${id}`)
  await q.sendBroadcast(id, ids.map(m => ({ member_id: m, channel: 'email', recipient: '' })))

  const { data: b } = await db.from('message_broadcasts')
    .select('status, total_recipients, sent_count, failed_count, skipped_count').eq('id', id).single()
  console.log(`\n✅ ${b.status} — destinatarios ${b.total_recipients} · enviados ${b.sent_count} · fallidos ${b.failed_count} · saltados ${b.skipped_count}`)
})().catch(e => { console.error(e); process.exit(1) })

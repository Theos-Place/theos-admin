/**
 * Pone al día los pagos de un evento cuyo formulario exige comprobante.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/pago-inscripcion-2026-10/completar-y-aprobar.ts
 *   aplicar:  ... --aplicar
 *
 * DOS COSAS, las dos reportadas por Floriana el 2026-10-07:
 *
 *  1 · CREA el pago que falta. Diez inscripciones del 10 de octubre no
 *      tenían NINGUNA fila en `payments`: nacieron por el camino automático,
 *      que hasta hoy creaba la inscripción y nada más. En el perfil de esas
 *      personas no aparecía ni el cobro.
 *
 *  2 · APRUEBA los que están en revisión. El 6 de octubre los dejé
 *      deliberadamente `en_revision`, con este argumento: «nadie verificó
 *      estos comprobantes contra el banco; des-aprobar 70 mal aprobados no
 *      es una acción». Floriana decidió lo contrario el 2026-10-07 y es su
 *      decisión: el formulario EXIGÍA el comprobante, así que el adjunto
 *      está, y revisar ochenta a mano cuesta más de lo que protege.
 *      Finanzas puede rechazar cualquiera después.
 *
 * SOLO TOCA A QUIEN TIENE COMPROBANTE. Si alguno no lo tuviera se reporta y
 * se queda como está: aprobar un pago sin adjunto sería inventar que pagó.
 *
 * IDEMPOTENTE y con respaldo en archivo para devolver los estados.
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const EVENTO = process.env.EVENT_ID || 'a43567a3-0adb-424c-8e8a-98dcad09b826'
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { pagoDeInscripcion, esCampoDeComprobante } =
    await import('@/lib/forms/pago-al-inscribirse')
  const sb = createAdminClient()

  const { data: ev } = await sb.from('events')
    .select('id, title, registration_form_id, requires_payment, payment_amount')
    .eq('id', EVENTO).single()
  if (!ev?.registration_form_id) throw new Error('El evento no tiene formulario de inscripción.')

  const { data: campos } = await sb.from('form_fields')
    .select('id, field_type, label, is_required').eq('form_id', ev.registration_form_id)
  const listaCampos = (campos ?? []) as Array<{ id: string; field_type: string; label: string | null; is_required: boolean }>
  const idsComprobante = new Set(listaCampos.filter(esCampoDeComprobante).map(c => c.id))

  const { data: regs } = await sb.from('event_registrations')
    .select('id, member_id, form_response_id, member:members!event_registrations_member_id_fkey(first_name, last_name)')
    .eq('event_id', EVENTO)
  const inscripciones = (regs ?? []) as Array<{
    id: string; member_id: string; form_response_id: string | null
    member: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  }>

  const { data: pagos } = await sb.from('payments')
    .select('id, member_id, status, review_status, receipt_path').eq('event_id', EVENTO)
  const porMiembro = new Map((pagos ?? []).map(p => [p.member_id as string, p as Record<string, unknown>]))

  // Las respuestas, para sacar el comprobante y la fecha declarada.
  const ids = inscripciones.map(r => r.form_response_id).filter((x): x is string => !!x)
  const valores = new Map<string, Array<{ field_id: string; value_text: string | null }>>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('form_response_values')
      .select('response_id, field_id, value_text').in('response_id', ids.slice(i, i + 200))
    for (const v of (data ?? []) as Array<{ response_id: string; field_id: string; value_text: string | null }>) {
      const l = valores.get(v.response_id) ?? []
      l.push({ field_id: v.field_id, value_text: v.value_text })
      valores.set(v.response_id, l)
    }
  }

  const nombre = (r: typeof inscripciones[number]) => {
    const m = Array.isArray(r.member) ? r.member[0] : r.member
    return [m?.first_name, m?.last_name].filter(Boolean).join(' ') || r.member_id
  }

  const crear: typeof inscripciones = []
  const aprobar: string[] = []
  const sinComprobante: string[] = []

  for (const r of inscripciones) {
    const resp = r.form_response_id ? valores.get(r.form_response_id) ?? [] : []
    const pago = pagoDeInscripcion({ campos: listaCampos, respuestas: resp, evento: ev })
    const existente = porMiembro.get(r.member_id)
    if (!pago) { sinComprobante.push(nombre(r)); continue }
    if (!existente) { crear.push(r); continue }
    if (existente.review_status !== 'aprobado' || existente.status !== 'paid') {
      aprobar.push(existente.id as string)
    }
  }

  console.log(`${ev.title} · ₡${Number(ev.payment_amount).toLocaleString('es-CR')}`)
  console.log(`inscripciones: ${inscripciones.length}  ·  pagos hoy: ${pagos?.length ?? 0}`)
  console.log(`  pagos a CREAR:          ${crear.length}`)
  console.log(`  pagos a APROBAR:        ${aprobar.length}`)
  console.log(`  SIN comprobante (no se tocan): ${sinComprobante.length}`)
  if (sinComprobante.length) console.log('   ' + sinComprobante.join(', '))
  if (crear.length) console.log('   crear para: ' + crear.map(nombre).join(', '))

  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); return }

  const respaldo = join(__dirname, `rollback-pagos-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  writeFileSync(respaldo, JSON.stringify({
    aprobar: (pagos ?? []).filter(p => aprobar.includes(p.id as string))
      .map(p => ({ id: p.id, status: p.status, review_status: p.review_status })),
    crear: crear.map(r => ({ member_id: r.member_id })),
  }, null, 2))
  console.log('\nrespaldo:', respaldo)

  let creados = 0
  for (const r of crear) {
    const resp = r.form_response_id ? valores.get(r.form_response_id) ?? [] : []
    const pago = pagoDeInscripcion({ campos: listaCampos, respuestas: resp, evento: ev })!
    const archivo = resp.find(v => idsComprobante.has(v.field_id) && (v.value_text ?? '').trim())?.value_text ?? null

    let receiptPath: string | null = null
    if (archivo) {
      const { data: file } = await sb.storage.from('form-uploads').download(archivo)
      if (file) {
        const destino = `${r.member_id}/${archivo}`
        const { error } = await sb.storage.from('payment-receipts')
          .upload(destino, file, { upsert: true, contentType: file.type || 'image/webp' })
        if (!error) receiptPath = destino
      }
    }
    const { error } = await sb.from('payments').insert({
      member_id: r.member_id, event_id: EVENTO, event_registration_id: r.id,
      amount: pago.amount, currency: 'CRC', concept: 'evento', entity_type: 'event',
      payment_method: 'comprobante', status: pago.status, review_status: pago.review_status,
      receipt_path: receiptPath, description: ev.title,
      ...(pago.payment_date ? { payment_date: pago.payment_date } : {}),
    })
    if (error) { console.log(`  ✗ ${nombre(r)}: ${error.message}`); continue }
    creados++
    console.log(`  ✓ ${nombre(r)}${receiptPath ? '' : '  (sin comprobante copiado)'}`)
  }

  let aprobados = 0
  for (let i = 0; i < aprobar.length; i += 100) {
    const { error, count } = await sb.from('payments')
      .update({ status: 'paid', review_status: 'aprobado' }, { count: 'exact' })
      .in('id', aprobar.slice(i, i + 100))
    if (error) throw error
    aprobados += count ?? 0
  }

  console.log(`\ncreados: ${creados}  ·  aprobados: ${aprobados}`)
  const { data: fin } = await sb.from('payments')
    .select('status, review_status').eq('event_id', EVENTO)
  const resumen = new Map<string, number>()
  for (const p of (fin ?? []) as Array<{ status: string; review_status: string }>) {
    const k = `${p.status} / ${p.review_status}`
    resumen.set(k, (resumen.get(k) ?? 0) + 1)
  }
  console.table([...resumen].map(([estado, n]) => ({ estado, n })))
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

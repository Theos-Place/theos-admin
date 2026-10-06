/**
 * Actividad Servidores (10-oct-2026): las 70 respuestas del formulario no
 * tienen inscripción.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/eve-servidores-2026-10/reconciliar.ts
 *   aplicar:  ... --aplicar
 *
 * QUÉ PASÓ. El evento SÍ tiene su formulario ligado
 * (`events.registration_form_id`), pero el sistema solo ENLAZA una respuesta
 * con una inscripción que YA EXISTA — nunca la crea. La gente llegó por el
 * link del formulario y no por el botón del evento, así que quedaron 70
 * respuestas y CERO inscripciones, y el tab se ve vacío.
 *
 * QUÉ HACE, por persona:
 *  1 · Copia el comprobante de `form-uploads` a `payment-receipts`. Son dos
 *      buckets distintos y la pantalla de finanzas lee el segundo: sin la
 *      copia, el pago aparecería «sin comprobante» y se perdería justo lo
 *      que la persona sí mandó.
 *  2 · Crea el PAGO con ese comprobante, en revisión. No es un cobro: la
 *      plata ya entró y el comprobante está adjunto.
 *  3 · Crea la inscripción, enlazada a su respuesta del formulario.
 *
 * POR QUÉ EN REVISIÓN Y NO APROBADO. Nadie verificó estos 70 comprobantes
 * contra el banco todavía: entraron por un formulario, no por la cola de
 * finanzas. Dejarlos en revisión los pone exactamente donde habrían estado
 * si la inscripción hubiera funcionado, y aprobarlos en lote después es una
 * acción; des-aprobar 70 mal aprobados no lo es.
 *
 * IDEMPOTENTE: salta a quien ya tenga inscripción o pago en este evento.
 */
import { readFileSync, existsSync } from 'node:fs'

const EVENTO = 'a43567a3-0adb-424c-8e8a-98dcad09b826'
const FORM = 'bb265cd0-9a2d-48f5-babe-9a3d32a3a52f'
const CAMPO_COMPROBANTE = 'f07eadb4-a53c-4500-9104-36e1be611999'
const CAMPO_FECHA = '2c1204b4-5e5b-4d11-8dba-9124275903d9'
const MONTO = 10000
const APLICAR = process.argv.includes('--aplicar')

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
if (!existsSync('.env.local')) { console.error('falta .env.local'); process.exit(1) }

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const sb = createAdminClient()

  // Las respuestas con su comprobante y su fecha, en una sola lectura.
  const { data: resp } = await sb
    .from('form_responses')
    .select(`
      id, member_id, submitted_at,
      member:members!form_responses_member_id_fkey(first_name, last_name),
      valores:form_response_values(field_id, value_text, value_json)
    `)
    .eq('form_id', FORM)
  const respuestas = (resp ?? []) as Array<{
    id: string; member_id: string | null; submitted_at: string
    member: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
    valores: Array<{ field_id: string; value_text: string | null; value_json: unknown }>
  }>

  // Quién YA tiene inscripción o pago: la idempotencia.
  const [{ data: yaInscritos }, { data: yaPagos }] = await Promise.all([
    sb.from('event_registrations').select('member_id').eq('event_id', EVENTO),
    sb.from('payments').select('member_id').eq('event_id', EVENTO),
  ])
  const conInscripcion = new Set(((yaInscritos ?? []) as Array<{ member_id: string }>).map(r => r.member_id))
  const conPago = new Set(((yaPagos ?? []) as Array<{ member_id: string | null }>).map(r => r.member_id))

  const valor = (r: typeof respuestas[number], campo: string): string | null => {
    const v = r.valores.find(x => x.field_id === campo)
    if (!v) return null
    return v.value_text ?? (typeof v.value_json === 'string' ? v.value_json : null)
  }
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x)

  const pendientes = respuestas.filter(r => r.member_id && !conInscripcion.has(r.member_id) && !conPago.has(r.member_id))
  const saltados = respuestas.length - pendientes.length

  console.log(`${respuestas.length} respuestas · ${pendientes.length} por reconciliar`
    + (saltados ? ` · ${saltados} ya tenían inscripción o pago` : '')
    + (APLICAR ? '' : '   (DRY RUN)'))
  console.log(`cada una: pago de ₡${MONTO.toLocaleString('es-CR')} EN REVISIÓN, con su comprobante\n`)

  let hechas = 0, sinComprobante = 0
  for (const r of pendientes) {
    const m = uno(r.member)
    const nombre = [m?.first_name, m?.last_name].filter(Boolean).join(' ').trim() || r.member_id!
    const archivo = valor(r, CAMPO_COMPROBANTE)
    const fecha = valor(r, CAMPO_FECHA)
    if (!archivo) { sinComprobante++; console.log(`  ⚠ ${nombre}: sin comprobante`); continue }
    if (!APLICAR) { console.log(`  ${nombre}  · pagó el ${fecha ?? '—'}`); continue }

    // 1 · El comprobante, al bucket que lee finanzas.
    const destino = `${r.member_id}/${archivo}`
    const { data: file, error: dlErr } = await sb.storage.from('form-uploads').download(archivo)
    if (dlErr || !file) { console.log(`  ✗ ${nombre}: no se pudo bajar el comprobante (${dlErr?.message})`); continue }
    const { error: upErr } = await sb.storage.from('payment-receipts')
      .upload(destino, file, { upsert: true, contentType: file.type || 'image/webp' })
    if (upErr) { console.log(`  ✗ ${nombre}: no se pudo copiar el comprobante (${upErr.message})`); continue }

    // 2 · El pago, con el comprobante y en revisión.
    const { data: pago, error: payErr } = await sb.from('payments').insert({
      member_id: r.member_id,
      event_id: EVENTO,
      amount: MONTO,
      currency: 'CRC',
      concept: 'evento',
      entity_type: 'event',
      payment_method: 'comprobante',
      status: 'pending',
      review_status: 'en_revision',
      receipt_path: destino,
      description: 'Actividad Servidores',
      // La fecha que la persona declaró en el formulario, si la puso.
      ...(fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? { payment_date: fecha } : {}),
    }).select('id').single()
    if (payErr) { console.log(`  ✗ ${nombre}: ${payErr.message}`); continue }

    // 3 · La inscripción, enlazada a su respuesta.
    const { error: regErr } = await sb.from('event_registrations').insert({
      event_id: EVENTO,
      member_id: r.member_id,
      payment_status: 'pending',
      form_response_id: r.id,
    })
    if (regErr) {
      console.log(`  ✗ ${nombre}: pago creado pero la inscripción falló (${regErr.message})`)
      continue
    }
    // El pago apunta a la inscripción, para que la aprobación la libere.
    const { data: reg } = await sb.from('event_registrations')
      .select('id').eq('event_id', EVENTO).eq('member_id', r.member_id).maybeSingle()
    if (reg) {
      await sb.from('payments')
        .update({ event_registration_id: (reg as { id: string }).id })
        .eq('id', (pago as { id: string }).id)
    }
    hechas++
    console.log(`  ✓ ${nombre}`)
  }

  console.log(`\n${APLICAR ? `${hechas} reconciliadas` : `${pendientes.length - sinComprobante} listas para reconciliar`}`
    + (sinComprobante ? ` · ${sinComprobante} sin comprobante` : ''))
  if (!APLICAR) console.log('Para aplicar: --aplicar')
}

main().catch(e => { console.error(e); process.exit(1) })

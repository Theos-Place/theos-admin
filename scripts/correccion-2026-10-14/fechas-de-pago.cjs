/**
 * Los 124 pagos «pagados» sin fecha de pago (2026-10-14).
 *
 * Nacieron `paid` por el camino del 2026-10-07 (formulario que exige
 * comprobante + comprobante adjunto) y ese INSERT no escribe `paid_at`. La
 * lista de finanzas los muestra «sin fecha de pago» aunque estén cancelados.
 *
 * La fecha correcta es la del comprobante, y existe: `storage.objects` guarda
 * cuándo se subió cada archivo. Las 124 la tienen.
 *
 *   node scripts/correccion-2026-10-14/fechas-de-pago.cjs            # ensayo
 *   node scripts/correccion-2026-10-14/fechas-de-pago.cjs --aplicar  # commit
 */
const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
setTimeout(() => { console.log('TOPE 120s'); process.exit(2) }, 120000)
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    select p.id, p.amount, p.concept, p.created_at, o.created_at as subida
      from payments p
      join storage.objects o on o.bucket_id='payment-receipts' and o.name=p.receipt_path
     where p.status='paid' and p.paid_at is null
     order by o.created_at`)
  console.log(`a fechar: ${rows.length}`)
  const porDia = {}
  for (const r of rows) { const d = new Date(r.subida).toISOString().slice(0, 10); porDia[d] = (porDia[d] || 0) + 1 }
  console.log('por día de subida:', porDia)
  // Sanidad: la subida nunca puede ser ANTES de que el pago existiera.
  const raros = rows.filter(r => new Date(r.subida) < new Date(r.created_at) - 60000)
  console.log(`subidas anteriores a la creación del pago (deberían ser 0): ${raros.length}`)
  fs.writeFileSync('scripts/correccion-2026-10-14/fechas-de-pago-respaldo.json',
    JSON.stringify(rows.map(r => ({ id: r.id, paid_at_antes: null, paid_at_despues: r.subida })), null, 2))
  await c.query('begin')
  const res = await c.query(`
    update payments p set paid_at = o.created_at
      from storage.objects o
     where o.bucket_id='payment-receipts' and o.name=p.receipt_path
       and p.status='paid' and p.paid_at is null`)
  console.log(`update tocó: ${res.rowCount}`)
  const { rows: [v] } = await c.query(`select count(*) n from payments where status='paid' and paid_at is null`)
  console.log(`quedan sin fecha: ${v.n}`)
  if (APLICAR && raros.length === 0) { await c.query('commit'); console.log('✅ APLICADO') }
  else { await c.query('rollback'); console.log('↩️  ROLLBACK (ensayo)') }
  await c.end(); process.exit(0)
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })

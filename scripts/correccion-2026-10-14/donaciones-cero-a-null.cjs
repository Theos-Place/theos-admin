/**
 * Los montos en CERO de donaciones pasan a NULL (Floriana, 2026-10-14).
 *
 * La carga «Donadores Jul - Set 2026» trajo 15.135 donaciones con monto 0:
 * traía donantes, no montos. Cero se lee como «donó ₡0» y confunde; null es
 * «monto no conocido», que es la verdad y lo que el reporte ya sabe tratar
 * (`hayMontos`). Un cero real como donación no existe.
 *
 *   node scripts/correccion-2026-10-14/donaciones-cero-a-null.cjs            # ensayo
 *   node scripts/correccion-2026-10-14/donaciones-cero-a-null.cjs --aplicar
 */
const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
setTimeout(() => { console.log('TOPE 120s'); process.exit(2) }, 120000)
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    select coalesce(source_file,'(a mano)') origen, to_char(donation_date,'YYYY-MM') mes, count(*) n
      from donations where amount = 0 group by 1,2 order by 2,1`)
  console.table(rows)
  const total = rows.reduce((a, r) => a + Number(r.n), 0)
  console.log(`en cero: ${total}`)
  const { rows: ids } = await c.query(`select id from donations where amount = 0`)
  fs.writeFileSync('scripts/correccion-2026-10-14/donaciones-cero-a-null-respaldo.json', JSON.stringify({ ids: ids.map(r => r.id) }))
  await c.query('begin')
  const u = await c.query(`update donations set amount = null where amount = 0`)
  const { rows: [v] } = await c.query(`select count(*) filter (where amount = 0) ceros, count(*) filter (where amount is null) nulos, count(amount) con_monto, sum(amount) suma from donations`)
  console.log(`update tocó ${u.rowCount} · después: ceros=${v.ceros} nulos=${v.nulos} con_monto=${v.con_monto} suma=₡${Math.round(v.suma)}`)
  if (APLICAR) { await c.query('commit'); console.log('✅ APLICADO') } else { await c.query('rollback'); console.log('↩️  ROLLBACK (ensayo)') }
  await c.end(); process.exit(0)
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })

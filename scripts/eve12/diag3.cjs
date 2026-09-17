/** EVE-12 · Etapa 1, punto 3: eventos sin comité organizador. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const t = await c.query(`select table_name from information_schema.tables where table_schema='public' and table_name like '%organizing%'`)
  console.log('tabla: ' + (t.rows.map(r=>r.table_name).join(', ') || 'NO EXISTE'))
  if (!t.rowCount) { await c.end(); return }
  const cc = await c.query(`select column_name from information_schema.columns where table_name='event_organizing_committees' and table_schema='public' order by ordinal_position`)
  console.log('columnas: ' + cc.rows.map(r=>r.column_name).join(', '))
  const q = async (t2, sql) => { const r = await c.query(sql); console.log(`  ${t2.padEnd(56)} ${r.rows[0].n}`) }
  console.log('\n=== eventos ===')
  await q('eventos en total', `select count(*) n from events`)
  await q('eventos FUTUROS o de los últimos 3 meses', `select count(*) n from events where starts_at > now() - interval '3 months'`)
  await q('de esos, SIN comité organizador', `select count(*) n from events e where e.starts_at > now() - interval '3 months'
    and not exists (select 1 from event_organizing_committees o where o.event_id=e.id)`)
  await q('con al menos un comité', `select count(*) n from events e where e.starts_at > now() - interval '3 months'
    and exists (select 1 from event_organizing_committees o where o.event_id=e.id)`)

  const s = await c.query(`
    select e.title, e.event_type, e.starts_at::date d
    from events e where e.starts_at > now() - interval '3 months'
      and not exists (select 1 from event_organizing_committees o where o.event_id=e.id)
    order by e.starts_at desc limit 15`)
  console.log(`\n=== sin comité, últimos/próximos (muestra de ${s.rowCount}) ===`)
  s.rows.forEach(x => console.log(`  ${x.d.toISOString().slice(0,10)}  ${String(x.event_type).padEnd(12)} ${x.title}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

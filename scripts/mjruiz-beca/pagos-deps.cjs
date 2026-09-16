/** SOLO LECTURA: qué depende de los dos pagos cancelados, y si el borrado se audita. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const PAGOS = ['05faec70-9164-4a42-9bb2-16b6559d8745','10762435-d76e-42c4-8ea1-66e30557975d']
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select * from payments where id = any($1) order by created_at`, [PAGOS])
  console.log('=== los dos pagos ===')
  r.rows.forEach(x => { console.log('---'); for (const [k,v] of Object.entries(x)) if (v!==null && v!=='') console.log(`  ${k}: ${JSON.stringify(v)}`) })

  // ¿Alguien los referencia?
  const fk = await c.query(`
    select cl.relname as tabla, con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con join pg_class cl on cl.oid=con.conrelid
    where con.contype='f' and pg_get_constraintdef(con.oid) like '%REFERENCES payments%'`)
  console.log('\n=== tablas que referencian payments ===')
  fk.rows.forEach(x => console.log(`  ${x.tabla}: ${x.def}`))
  for (const t of [...new Set(fk.rows.map(x=>x.tabla))]) {
    const col = fk.rows.find(x=>x.tabla===t).def.match(/FOREIGN KEY \((\w+)\)/)[1]
    const n = await c.query(`select count(*) from ${t} where ${col} = any($1)`, [PAGOS])
    console.log(`  -> filas en ${t}.${col} apuntando a estos pagos: ${n.rows[0].count}`)
  }

  // ¿El trigger de auditoría cubre payments y DELETE?
  const tg = await c.query(`
    select tgname, pg_get_triggerdef(t.oid) as def from pg_trigger t
    join pg_class c2 on c2.oid=t.tgrelid where c2.relname='payments' and not t.tgisinternal`)
  console.log('\n=== triggers en payments ===')
  tg.rows.forEach(x => console.log(`  ${x.def}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

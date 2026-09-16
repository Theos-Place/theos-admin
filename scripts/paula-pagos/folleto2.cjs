const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const p = await c.query(`
    select pa.id, m.first_name||' '||m.last_name as persona, pa.amount, pa.status, pa.description,
           pa.entity_type, pa.folleto_request_id, g.name as grupo, pa.created_at
    from payments pa left join members m on m.id=pa.member_id
      left join study_groups g on g.id=pa.study_group_id
    where pa.concept='folletos' order by pa.created_at desc limit 15`)
  console.log(`=== cobros concept='folletos' (${p.rowCount}) ===`)
  p.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  const n = await c.query(`select count(*) n from payments where concept='folletos'`)
  console.log(`\ntotal en la base: ${n.rows[0].n}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

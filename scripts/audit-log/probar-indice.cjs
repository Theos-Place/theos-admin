const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const id = (await c.query(`select entity_id from audit_log where entity_type='members' limit 1`)).rows[0].entity_id
    const medir = async (t) => {
      const r = await c.query(`explain (analyze, buffers) select old_data, new_data from audit_log where entity_id=$1 order by created_at desc limit 5`, [id])
      const p = r.rows.map(x=>x['QUERY PLAN']).join('\n')
      console.log(`  ${t.padEnd(22)} ${p.match(/Execution Time: ([\d.]+)/)?.[1]} ms · buffers ${p.match(/Buffers: shared hit=(\d+)/)?.[1]} · ${p.match(/(Index Scan using \w+|Seq Scan)/)?.[1]}`)
    }
    await medir('índice actual')
    await c.query(`create index idx_audit_entity_id on audit_log (entity_id)`)
    await medir('con índice por entity_id')
    await c.query('rollback'); console.log('(revertido)')
  } catch (e) { await c.query('rollback'); console.error(e.message); process.exitCode=1 }
  finally { await c.end() }
})()

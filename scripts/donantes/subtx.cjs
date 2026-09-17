const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const q = async (t, sql) => { try { const r = await c.query(sql); console.log(`\n=== ${t} ===`); r.rows.forEach(x=>console.log('  '+JSON.stringify(x))) } catch(e){ console.log(`\n=== ${t} ===\n  ${e.message}`) } }
  await q('SLRU: contención de subtransacciones', `select name, blks_read, blks_hit, blks_written, flushes from pg_stat_slru where name in ('subtransaction','Subtrans','multixact_offset')`)
  await q('transacciones largas abiertas', `select pid, state, round(extract(epoch from (now()-xact_start))) seg_xact, backend_xid from pg_stat_activity where xact_start is not null and pid <> pg_backend_pid() order by xact_start limit 5`)
  await q('cuándo se reinició pg_stat_statements', `select stats_reset from pg_stat_statements_info`)
  await q('escrituras por hora en las tablas auditadas (hoy)', `
    select to_char(date_trunc('hour', created_at),'HH24:MI') h, count(*) n
    from audit_log where created_at > now() - interval '12 hours' group by 1 order by 1`)
  await q('tiempo de un UPDATE trivial (mide el trigger)', `
    explain (analyze, timing, buffers) update members set updated_at = updated_at where id = (select id from members limit 1)`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const q = async (t, sql) => { const r = await c.query(sql); console.log(`\n=== ${t} ===`); r.rows.forEach(x=>console.log('  '+JSON.stringify(x))) }
  await q('espacio muerto en audit_log', `select n_live_tup vivas, n_dead_tup muertas,
    last_vacuum, last_autovacuum, last_analyze from pg_stat_user_tables where relname='audit_log'`)
  await q('cuánto borraría el prune HOY', `select count(*) n from audit_log where created_at < now() - interval '90 days'`)
  await q('cuánto quedará después del 16 de octubre', `
    select count(*) filter (where created_at >= '2026-07-19') quedan,
           count(*) filter (where created_at < '2026-07-19') se_van,
           count(*) total from audit_log`)
  await q('espacio del disco', `select pg_size_pretty(pg_database_size(current_database())) base`)
  await q('últimas corridas del prune', `select status, start_time, return_message from cron.job_run_details
    where jobid=(select jobid from cron.job where jobname='prune-audit-log') order by start_time desc limit 3`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

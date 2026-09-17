const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const q = async (t, sql) => { try { const r = await c.query(sql); console.log(`\n=== ${t} ===`); r.rows.forEach(x=>console.log('  '+JSON.stringify(x))) } catch(e){ console.log(`\n=== ${t} ===\n  ${e.message}`) } }
  await q('límite de conexiones vs uso', `select (select setting::int from pg_settings where name='max_connections') max_conn,
     (select count(*) from pg_stat_activity) en_uso,
     (select count(*) from pg_stat_activity where state='idle in transaction') idle_en_tx`)
  await q('conexiones por aplicación', `select coalesce(application_name,'(sin nombre)') app, state, count(*) n from pg_stat_activity group by 1,2 order by 3 desc limit 10`)
  await q('acierto de caché (ideal > 0.99)', `select round(sum(blks_hit)::numeric/nullif(sum(blks_hit)+sum(blks_read),0), 4) ratio, pg_size_pretty(sum(blks_read)*8192) leido_de_disco from pg_stat_database where datname=current_database()`)
  await q('tamaño de la base', `select pg_size_pretty(pg_database_size(current_database())) tam`)
  await q('tablas más grandes', `select relname, pg_size_pretty(pg_total_relation_size(c.oid)) tam from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by pg_total_relation_size(c.oid) desc limit 6`)
  await q('trabajos de pg_cron corriendo AHORA', `select jobid, status, start_time from cron.job_run_details where status='running'`)
  await c.end()
})().catch(e => { console.error('conexión falló:', e.code ?? e.message); process.exit(1) })

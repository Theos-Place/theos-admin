/** SOLO LECTURA: qué está lento AHORA. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const q = async (t, sql) => {
    try { const r = await c.query(sql); console.log(`\n=== ${t} (${r.rowCount}) ===`); r.rows.forEach(x => console.log('  ' + JSON.stringify(x))) }
    catch (e) { console.log(`\n=== ${t} ===\n  ERROR: ${e.message}`) }
  }
  await q('consultas ACTIVAS ahora mismo', `
    select pid, state, wait_event_type, wait_event,
           round(extract(epoch from (now()-query_start))) as seg,
           left(regexp_replace(query, '\\s+', ' ', 'g'), 110) as q
    from pg_stat_activity
    where state <> 'idle' and pid <> pg_backend_pid()
    order by query_start limit 12`)
  await q('bloqueos', `select count(*) n from pg_locks where not granted`)
  await q('conexiones por estado', `select state, count(*) n from pg_stat_activity group by 1 order by 2 desc`)
  await q('tamaño de audit_log', `select pg_size_pretty(pg_total_relation_size('audit_log')) tam, (select count(*) from audit_log) filas`)
  await q('filas de audit_log por hora, últimas 8', `
    select to_char(date_trunc('hour', created_at),'DD HH24:MI') h, count(*) n
    from audit_log where created_at > now() - interval '8 hours' group by 1 order by 1`)
  await q('subtransacciones (el costo de EXCEPTION en plpgsql)', `
    select datname, xact_commit, xact_rollback from pg_stat_database where datname = current_database()`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

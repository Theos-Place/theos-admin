/** SOLO LECTURA: qué hay en audit_log y qué hace el prune que ya existe. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`select pg_get_functiondef(oid) as def from pg_proc where proname='prune_audit_log'`)
  console.log('=== prune_audit_log (el que ya corre a las 04:00 UTC) ===\n' + (f.rows[0]?.def ?? 'NO EXISTE'))

  const q = async (t, sql) => { const r = await c.query(sql); console.log(`\n=== ${t} ===`); r.rows.forEach(x=>console.log('  '+Object.values(x).map(v=>String(v)).join('  ·  '))) }
  await q('por año', `select to_char(created_at,'YYYY-MM') mes, count(*) n, pg_size_pretty(sum(pg_column_size(old_data)+pg_column_size(new_data))) peso
    from audit_log group by 1 order by 1`)
  await q('por tabla (top 10)', `select entity_type, count(*) n, pg_size_pretty(sum(pg_column_size(old_data)+pg_column_size(new_data))) peso
    from audit_log group by 1 order by 2 desc limit 10`)
  await q('por acción', `select action, count(*) n from audit_log group by 1 order by 2 desc`)
  await q('con actor vs sin actor', `select (actor_id is not null) tiene_actor, count(*) n from audit_log group by 1`)
  await q('el día de la carga masiva', `select created_at::date dia, count(*) n from audit_log group by 1 order by 2 desc limit 5`)
  await q('índices de la tabla', `select indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) tam from pg_indexes where tablename='audit_log'`)
  await q('peso: datos vs índices', `select pg_size_pretty(pg_relation_size('audit_log')) solo_tabla,
    pg_size_pretty(pg_indexes_size('audit_log')) indices, pg_size_pretty(pg_total_relation_size('audit_log')) total`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

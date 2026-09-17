/** SOLO LECTURA: sesiones de asistencia de los grupos de Floriana. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`select id, first_name||' '||last_name n, email from members
    where unaccent(lower(first_name||' '||last_name)) like '%floriana%fonseca%'`)
  console.log('fichas: '); f.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  const g = await c.query(`select id, name, status, current_week, starts_at from study_groups
    where (leader_id = any($1) or co_leader_id = any($1)) and status <> 'finalizado'`, [f.rows.map(x=>x.id)])
  console.log('\ngrupos vivos que dirige:'); g.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  for (const gr of g.rows) {
    const s = await c.query(`select id, session_date, topic, created_at,
        (select count(*) from study_attendance a where a.session_id=s.id) marcas,
        (select count(*) filter (where a.present) from study_attendance a where a.session_id=s.id) presentes
      from study_sessions s where s.group_id=$1 order by s.session_date, s.created_at`, [gr.id])
    console.log(`\n=== sesiones de "${gr.name}" (${s.rowCount}) ===`)
    s.rows.forEach(x => console.log(`  ${x.session_date.toISOString().slice(0,10)}  ${String(x.topic ?? '—').slice(0,26).padEnd(28)} ${x.presentes}/${x.marcas}  creada ${x.created_at.toISOString().slice(0,16)}  ${x.id}`))
  }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

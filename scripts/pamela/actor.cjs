const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const m = await c.query(`select id, first_name, last_name, email, auth_user_id, is_active
    from members where unaccent(lower(first_name||' '||last_name)) like '%estudios%biblicos%'`)
  console.log('=== la cuenta que figura en la nota ===')
  m.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  for (const x of m.rows) {
    const r = await c.query(`select role from member_roles where member_id=$1`, [x.id])
    console.log(`  roles: ${r.rows.map(y=>y.role).join(', ') || 'ninguno'}`)
  }
  // Hora de Costa Rica de los dos momentos.
  const t = await c.query(`select
    ('2026-09-10 20:39:14.695+00'::timestamptz at time zone 'America/Costa_Rica') as creada,
    ('2026-09-11 14:10:57.011+00'::timestamptz at time zone 'America/Costa_Rica') as movida`)
  console.log('\n=== hora de Costa Rica ===')
  console.log('  matrícula original en SCJ — Oeste SJ: ' + t.rows[0].creada)
  console.log('  traslado a SCJ — Este SJ:             ' + t.rows[0].movida)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const u = await c.query(`select id from auth.users limit 1`)
  const USER = u.rows[0].id
  await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-actor-user-id': USER })])
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })])

  const p = async (t, sql) => {
    try { const r = await c.query(sql); console.log(`  ${t.padEnd(38)} ${JSON.stringify(r.rows[0])}`) }
    catch (e) { console.log(`  ${t.padEnd(38)} ERROR: ${e.message}`) }
  }
  await p('rol del claim', `select nullif(current_setting('request.jwt.claims', true),'')::json ->> 'role' as v`)
  await p('header crudo', `select nullif(current_setting('request.headers', true),'') as v`)
  await p('header parseado', `select nullif(current_setting('request.headers', true),'')::json ->> 'x-actor-user-id' as v`)
  await p('el regex de uuid', `select ($1::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as v`.replace('$1', `'${USER}'`))
  await p('¿existe en auth.users?', `select id from auth.users where id = '${USER}'::uuid`)
  await p('auth.uid()', `select auth.uid() as v`)
  // ¿Quién es el dueño de la función?
  await p('dueño de log_changes', `select pg_get_userbyid(proowner) as v from pg_proc where proname='log_changes'`)
  await p('usuario actual', `select current_user as v, session_user as su`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

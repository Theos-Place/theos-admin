const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const u = await c.query(`select id from auth.users limit 1`)
  const USER = u.rows[0].id
  await c.query('begin')
  await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-actor-user-id': USER })])
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })])
  const r = await c.query(`
    select nullif(current_setting('request.jwt.claims', true),'')::json ->> 'role' as rol,
           nullif(current_setting('request.headers', true),'')::json ->> 'x-actor-user-id' as actor`)
  console.log('dentro de la transacción: ' + JSON.stringify(r.rows[0]))
  await c.query('rollback'); await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

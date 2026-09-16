const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select id, first_name, last_name, email, auth_user_id from members where id='c6995364-54f0-4ec6-8d5d-275fa2461f7f' or lower(email)='ti@theosplace.org'`)
  r.rows.forEach(x => console.log(JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

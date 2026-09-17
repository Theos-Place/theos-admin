const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select count(*) personas, sum(n) asistencias from (
      select ec.member_id, count(*) n
      from event_checkins ec join events e on e.id=ec.event_id
      where e.is_recurring and ec.member_id is not null
      group by 1 having count(*) > 1) x`)
  console.log('personas con 2+ asistencias a un mismo evento recurrente: ' + r.rows[0].personas)
  console.log('  asistencias involucradas (se veían todas con la misma fecha): ' + r.rows[0].asistencias)
  const e = await c.query(`select count(*) n from events where is_recurring`)
  console.log('\neventos recurrentes en total: ' + e.rows[0].n)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

/**
 * La copia de Semillitas que quedó del intento. Solo esa: los otros dos
 * "Semillitas Kids&Teens" no dicen "(copia)" y hay que preguntar cuál se queda.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const objetivo = await c.query(
      `select id, title from events where title ilike '%Semillitas%(copia)%'`)
    if (objetivo.rowCount !== 1) throw new Error(`se esperaba 1 copia, hay ${objetivo.rowCount}`)
    const { id, title } = objetivo.rows[0]
    const u = (await c.query(`
      select (select count(*) from event_checkins where event_id=$1)::int checkins,
             (select count(*) from event_registrations where event_id=$1)::int inscripciones,
             (select count(*) from payments where event_id=$1)::int pagos,
             (select count(*) from finance_requests where event_id=$1)::int solicitudes,
             (select count(*) from scholarships where event_id=$1)::int becas`, [id])).rows[0]
    console.log(`${title}:`, u)
    if (Object.values(u).some(n => n > 0)) throw new Error('tiene datos asociados — no se borra')
    await c.query('delete from events where parent_event_id=$1', [id])
    await c.query('delete from events where id=$1', [id])

    const quedan = await c.query(`
      select id, title, to_char(starts_at at time zone 'America/Costa_Rica','YYYY-MM-DD') f
      from events where title ilike '%emillitas%' order by starts_at`)
    console.table(quedan.rows.map(x => ({ id: x.id.slice(0, 8), titulo: x.title, inicio: x.f })))
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

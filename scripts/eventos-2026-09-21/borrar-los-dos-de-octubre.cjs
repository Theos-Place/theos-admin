/**
 * Los dos "Cárcel de Mujeres" que arrancan el 2 de octubre, que quedaron de los
 * intentos con el fin de la serie mal guardado (ver el fix del 2026-09-21).
 * Ninguno iba a generar el 16.
 *
 * NO se toca 58c6d07f (18 de setiembre): es otro evento y hay que preguntarlo.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    // Se resuelven por consulta y no por id escrito a mano: el id completo hay
    // que leerlo de la base, y así el script dice con qué criterio eligió.
    const objetivo = await c.query(`
      select id, title from events
      where title ilike 'C_rcel%'
        and (starts_at at time zone 'America/Costa_Rica')::date = '2026-10-02'`)
    console.log(`eventos que arrancan el 2026-10-02: ${objetivo.rowCount}`)
    if (objetivo.rowCount !== 2) throw new Error('se esperaban exactamente 2 — revisar antes de borrar')

    for (const { id, title } of objetivo.rows) {
      const u = (await c.query(`
        select (select count(*) from event_checkins where event_id=$1)::int checkins,
               (select count(*) from event_registrations where event_id=$1)::int inscripciones,
               (select count(*) from payments where event_id=$1)::int pagos,
               (select count(*) from finance_requests where event_id=$1)::int solicitudes,
               (select count(*) from scholarships where event_id=$1)::int becas`, [id])).rows[0]
      console.log(`  ${id.slice(0, 8)} ${title}:`, u)
      if (Object.values(u).some(n => n > 0)) throw new Error(`${id} tiene datos asociados — no se borra`)
      // Los hijos override primero: su FK es ON DELETE SET NULL y quedarían sueltos.
      await c.query('delete from events where parent_event_id=$1', [id])
      await c.query('delete from events where id=$1', [id])
    }

    const quedan = await c.query(`
      select id, title,
        to_char(starts_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') inicio,
        to_char(recurrence_end at time zone 'America/Costa_Rica','YYYY-MM-DD') hasta
      from events where title ilike 'C_rcel%' order by starts_at`)
    console.table(quedan.rows.map(x => ({ id: x.id.slice(0, 8), inicio: x.inicio, hasta: x.hasta })))

    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

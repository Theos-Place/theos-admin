/**
 * Limpieza de los dos eventos que dejó el bug de duplicar (2026-09-21).
 *
 * Se conserva 'Cárcel de Mujeres' b2906b93 (02-oct), que es el que quedó bien.
 * Se borran la copia recurrente que se quedó en la fecha vieja y el hijo que
 * generó al guardar con "solo esta instancia".
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
// El HIJO primero: su FK a events es ON DELETE SET NULL, así que borrar al
// padre antes lo dejaría suelto en el calendario sin que nadie lo note.
const A_BORRAR = [
  ['4fdab1c9-ebca-4a23-b512-f519fab7b02c', 'hijo override, 02-oct'],
  ['be2f948a-4476-4802-8d9f-a361ec329384', 'copia recurrente, 04-set'],
]
const SE_CONSERVA = 'b2906b93-d369-4554-9956-b6a42555ddd8'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    for (const [id, que] of A_BORRAR) {
      // Guard: nada que borrar si alguien ya lo usó.
      const usos = await c.query(`
        select (select count(*) from event_checkins where event_id=$1)::int checkins,
               (select count(*) from event_registrations where event_id=$1)::int inscripciones,
               (select count(*) from payments where event_id=$1)::int pagos,
               (select count(*) from finance_requests where event_id=$1)::int solicitudes,
               (select count(*) from scholarships where event_id=$1)::int becas`, [id])
      const u = usos.rows[0]
      console.log(`${id.slice(0, 8)} (${que}):`, u)
      if (Object.values(u).some(n => n > 0)) throw new Error(`${id} tiene datos asociados — no se borra`)
      const r = await c.query('delete from events where id=$1', [id])
      console.log(`  borrado: ${r.rowCount}`)
    }

    const quedan = await c.query(`
      select id, title, starts_at::date fecha, is_recurring, parent_event_id
      from events where title ilike 'C_rcel de Mujeres%' order by created_at`)
    console.table(quedan.rows)
    const sobrevive = quedan.rows.some(x => x.id === SE_CONSERVA)
    const huerfanos = quedan.rows.filter(x => x.parent_event_id).length
    console.log(`se conserva el bueno: ${sobrevive} · huérfanos: ${huerfanos}`)
    if (!sobrevive) throw new Error('se borró el que había que conservar — rollback')

    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

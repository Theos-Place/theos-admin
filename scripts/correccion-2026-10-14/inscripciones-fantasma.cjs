/**
 * Las inscripciones fantasma de los formularios compartidos (2026-10-14).
 *
 * Un formulario pegado a varias sesiones inscribía —y cobraba— en todas. La
 * regla de Floriana: «se inscriben únicamente al día que están escogiendo».
 * Ese día está en la respuesta (campo de fecha «…actividad de mi interés»).
 *
 * QUÉ HACE: para cada persona cuyo día elegido coincide con UNA sesión, borra
 * las inscripciones de las OTRAS sesiones y anula sus cobros (status
 * 'cancelado', que finanzas ve como «Anulado»; no se borran, para que el
 * comprobante y la traza queden). Cero check-ins en todas ellas: nadie fue.
 *
 * A QUIÉN NO TOCA: a quien eligió un día que no es sesión (Eduardo Bonilla
 * 10-oct, José Carlos Mora 12-oct). Adivinar «la más cercana» es justo cómo
 * terminaron cobrados de más. Se reportan y los decide Floriana.
 *
 *   node scripts/correccion-2026-10-14/inscripciones-fantasma.cjs            # ensayo
 *   node scripts/correccion-2026-10-14/inscripciones-fantasma.cjs --aplicar
 */
const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
setTimeout(() => { console.log('TOPE 120s'); process.exit(2) }, 120000)
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    with elegida as (
      select fr.id respuesta, fr.member_id, left(a.value_text,10) fecha
        from form_responses fr join forms f on f.id=fr.form_id
        join form_response_values a on a.response_id=fr.id
        join form_fields ff on ff.id=a.field_id and ff.field_type='date' and ff.label ilike '%actividad%'
       where f.id in (select registration_form_id from events group by registration_form_id having count(*) > 1)),
    sesiones as (
      select er.id reg, er.member_id, er.event_id, el.fecha elegida, el.respuesta,
             to_char(e.starts_at at time zone 'America/Costa_Rica','YYYY-MM-DD') dia, btrim(e.title) evento
        from event_registrations er join elegida el on el.respuesta=er.form_response_id
        join events e on e.id=er.event_id),
    con_coincidencia as (select respuesta from sesiones group by respuesta having bool_or(dia = elegida))
    select s.reg, s.member_id, m.first_name||' '||m.last_name persona, s.evento, s.dia, s.elegida,
           (select count(*) from event_checkins ci where ci.event_id=s.event_id and ci.member_id=s.member_id) checkins,
           array_remove(array_agg(p.id), null) pagos, coalesce(sum(p.amount),0) monto
      from sesiones s join members m on m.id=s.member_id
      left join payments p on p.event_registration_id=s.reg and p.status in ('paid','pending')
     where s.dia <> s.elegida and s.respuesta in (select respuesta from con_coincidencia)
     group by s.reg, s.member_id, m.first_name, m.last_name, s.evento, s.dia, s.elegida, s.event_id
     order by persona, s.dia`)
  const conCheckin = rows.filter(r => Number(r.checkins) > 0)
  console.log(`inscripciones fantasma a borrar: ${rows.length} · personas: ${new Set(rows.map(r => r.member_id)).size}`)
  console.log(`cobros a anular: ${rows.reduce((a, r) => a + r.pagos.length, 0)} · monto: ₡${rows.reduce((a, r) => a + Number(r.monto), 0)}`)
  console.log(`con check-in (NO se tocan si hay): ${conCheckin.length}`)
  for (const r of rows) console.log(`  ${r.persona.padEnd(32)} ${r.evento.padEnd(11)} ${r.dia}  (eligió ${r.elegida})  cobros ${r.pagos.length}`)
  const { rows: fuera } = await c.query(`
    with elegida as (
      select fr.id respuesta, fr.member_id, left(a.value_text,10) fecha
        from form_responses fr join forms f on f.id=fr.form_id
        join form_response_values a on a.response_id=fr.id
        join form_fields ff on ff.id=a.field_id and ff.field_type='date' and ff.label ilike '%actividad%'
       where f.id in (select registration_form_id from events group by registration_form_id having count(*) > 1))
    select distinct m.first_name||' '||m.last_name persona, el.fecha elegida
      from elegida el join event_registrations er on er.form_response_id=el.respuesta join members m on m.id=el.member_id
     group by el.respuesta, m.first_name, m.last_name, el.fecha
    having not bool_or(to_char((select starts_at from events where id=er.event_id) at time zone 'America/Costa_Rica','YYYY-MM-DD') = el.fecha)`)
  console.log(`\nSIN sesión que coincida (se dejan para Floriana): ${fuera.map(f => `${f.persona} (${f.elegida})`).join('; ') || 'ninguno'}`)
  fs.writeFileSync('scripts/correccion-2026-10-14/inscripciones-fantasma-respaldo.json', JSON.stringify(rows, null, 2))
  if (conCheckin.length) { console.log('❌ hay check-ins: no se aplica'); await c.end(); process.exit(1) }
  const regs = rows.map(r => r.reg), pagos = rows.flatMap(r => r.pagos)
  await c.query('begin')
  const p1 = pagos.length ? await c.query(`update payments set status='cancelado', review_status=null where id = any($1::uuid[]) and status in ('paid','pending')`, [pagos]) : { rowCount: 0 }
  const p2 = await c.query(`delete from event_registrations where id = any($1::uuid[])`, [regs])
  console.log(`\ncobros anulados: ${p1.rowCount} · inscripciones borradas: ${p2.rowCount}`)
  if (APLICAR) { await c.query('commit'); console.log('✅ APLICADO') } else { await c.query('rollback'); console.log('↩️  ROLLBACK (ensayo)') }
  await c.end(); process.exit(0)
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })

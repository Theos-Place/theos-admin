/**
 * DAT-8 · Vaciar la fecha de nacimiento de las fichas mal fechadas.
 *
 * DECISIÓN DEL USUARIO (2026-09-18). De los 24 "menores de 12 con correo y sin
 * familia", 22 no son menores: la fecha está mal. Se excluyen a mano Lucía y
 * Naomy Sánchez Arguedas, que sí son hermanas — comparten el correo de un
 * adulto que no tiene ficha y son las ÚNICAS dos con check-in en un evento
 * Youth. Los demás que asistieron fueron a charlas, que son de adultos.
 *
 * POR QUÉ VACIAR Y NO CORREGIR. Nadie sabe la fecha real. Con una fecha falsa
 * el sistema los trata como menores: no les crea cuenta, les exige familia y
 * los cuenta mal en todo reporte por edad. Sin fecha simplemente no se sabe,
 * que es la verdad, y el alta de adultos sin fecha ya está contemplada (FAM-2:
 * "sin fecha de nacimiento NO se asume menor").
 *
 * SE PUEDE DESHACER: el valor viejo queda en `audit_log.old_data`.
 *
 * Dry-run por defecto; `--aplicar` escribe dentro de una transacción que
 * verifica antes de confirmar. El cambio va FIRMADO con la cuenta de quien lo
 * pidió (AUD-2), no como "el sistema".
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const ACTOR = 'ti@theosplace.org'
/** Las dos que NO se tocan. Por id, nunca por nombre (AGENTS.md). */
const EXCLUIDAS = new Set([])

;(async () => {
  const c = await nuevoCliente(); await c.connect()

  const { rows } = await c.query(`
    select m.id, m.first_name||' '||m.last_name nombre, m.email,
           to_char(m.birth_date,'YYYY-MM-DD') fecha,
           date_part('year', age(m.birth_date))::int edad,
           (select count(*) from event_checkins ec join events e on e.id = ec.event_id
             where ec.member_id = m.id and e.title ilike '%youth%') youth
    from members m
    where m.is_active and m.birth_date is not null
      and date_part('year', age(m.birth_date)) < 12
      and coalesce(trim(m.email),'') <> ''
      and not exists (select 1 from family_members fm2
        where fm2.family_unit_id in (select family_unit_id from family_members where member_id = m.id)
          and fm2.member_id <> m.id)
    order by m.last_name, m.first_name`)

  // GUARDA MECÁNICA, no una lista escrita a mano: se excluye a quien tenga
  // check-in en un evento Youth. Es la señal que usó el usuario para salvar a
  // las hermanas Sánchez, y así no depende de que yo copie bien dos nombres.
  const aVaciar = rows.filter(r => Number(r.youth) === 0 && !EXCLUIDAS.has(r.id))
  const salvadas = rows.filter(r => Number(r.youth) > 0 || EXCLUIDAS.has(r.id))

  console.log(`candidatas: ${rows.length}`)
  console.log(`\n── SE CONSERVAN (check-in en Youth → sí son menores): ${salvadas.length}`)
  salvadas.forEach(r => console.log(`   ${r.nombre.padEnd(30)} ${r.fecha}  (${r.youth} check-in Youth)`))
  console.log(`\n── SE VACÍA LA FECHA: ${aVaciar.length}`)
  aVaciar.forEach(r => console.log(`   ${String(r.edad).padStart(2)}a  ${r.nombre.padEnd(30)} ${r.fecha}  ${r.email}`))

  if (aVaciar.length !== rows.length - salvadas.length) throw new Error('GUARDA: las cuentas no cuadran')
  if (!APLICAR) { console.log('\n>>> DRY-RUN: no se escribió nada'); await c.end(); return }

  const { rows: au } = await c.query(`select id from auth.users where email = $1`, [ACTOR])
  if (!au.length) throw new Error(`GUARDA: no encuentro la cuenta ${ACTOR} para firmar`)
  const ids = aVaciar.map(r => r.id)

  await c.query('begin')
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })])
  await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-actor-user-id': au[0].id })])
  const { rowCount } = await c.query(`update members set birth_date = null where id = any($1)`, [ids])
  if (rowCount !== ids.length) { await c.query('rollback'); throw new Error(`se tocaron ${rowCount} y eran ${ids.length} — rollback`) }

  const { rows: quedan } = await c.query(
    `select count(*) n from members where id = any($1) and birth_date is not null`, [ids])
  if (Number(quedan[0].n) > 0) { await c.query('rollback'); throw new Error('alguna quedó con fecha — rollback') }
  const { rows: firmadas } = await c.query(`
    select count(*) n from audit_log where entity_type='members' and entity_id = any($1)
      and actor_id = $2 and new_data ? 'birth_date'`, [ids, au[0].id])
  console.log(`\nfilas de auditoría firmadas: ${firmadas[0].n} de ${ids.length}`)
  if (Number(firmadas[0].n) !== ids.length) { await c.query('rollback'); throw new Error('no todas quedaron firmadas — rollback') }
  await c.query('commit')
  console.log('>>> APLICADO. El valor viejo queda en audit_log.old_data por si hay que devolverlo.')
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

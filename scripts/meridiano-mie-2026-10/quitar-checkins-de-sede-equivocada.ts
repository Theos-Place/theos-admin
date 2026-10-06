/**
 * Los 3 check-ins del 9 de setiembre que quedaron en la SEDE EQUIVOCADA.
 *
 *   dry-run:  npx tsx scripts/meridiano-mie-2026-10/quitar-checkins-de-sede-equivocada.ts
 *   aplicar:  ... --aplicar
 *
 * QUÉ PASÓ. El 9 de setiembre —el primer miércoles con los nombres nuevos—
 * tres personas quedaron registradas en Pedregal Miércoles entre las 19:11 y
 * las 19:12, y en Meridiano Miércoles entre las 19:15 y las 19:17. Cuatro
 * minutos entre dos sedes distintas no es asistencia doble: es que quien
 * registraba tenía la charla equivocada seleccionada, se dio cuenta y las
 * volvió a meter en la correcta. Las tres primeras quedaron colgando.
 *
 * CUÁL ES LA BUENA, verificado por el historial de cada una: las tres son de
 * Meridiano (23, 10 y 6 check-ins ahí) y su ÚNICO Pedregal Miércoles en todo
 * 2026 es justamente el de ese minuto.
 *
 * POR QUÉ SE BORRA Y NO SE REAPUNTA: el check-in correcto YA EXISTE. Mover el
 * malo a Meridiano Miércoles crearía un duplicado.
 *
 * LO QUE NO SE TOCA. Los otros dos choques del año (Kattia Alvarado el 25-feb,
 * Gabriel Pacheco el 3-jun) son del import viejo, con hora 12:00 de relleno:
 * sin hora real no hay forma de saber si visitó otra sede de verdad, y borrar
 * por sospecha es peor que dejar el dato.
 *
 * Tampoco se tocan los pares «<sede>» + «<sede> Youth» del mismo día: ésos son
 * la misma sede y el modelo viejo de los youth, no un error.
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)![1]
const c = new Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
})
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  await c.connect()

  /**
   * No se listan ids a mano: se vuelve a DERIVAR la condición. Un id pegado a
   * mano no se puede verificar al releerlo, y si alguien ya arregló uno el
   * script lo borraría igual.
   *
   * La condición es la que prueba el error: misma persona, mismo día, dos
   * sedes distintas a menos de 15 minutos. Se borra el de Pedregal Miércoles
   * porque es el PRIMERO (el equivocado) y el de Meridiano es la corrección.
   */
  const { rows } = await c.query(`
    with chk as (
      select ec.id, ec.member_id, e.title,
             ec.checked_in_at,
             (ec.checked_in_at at time zone 'America/Costa_Rica')::date dia
        from events e join event_checkins ec on ec.event_id = e.id
       where e.event_type = 'charla' and ec.checked_in_at is not null
    )
    select a.id, trim(m.first_name||' '||m.last_name) persona,
           a.title titulo_malo, b.title titulo_bueno,
           to_char(a.checked_in_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') hora_mala,
           to_char(b.checked_in_at at time zone 'America/Costa_Rica','HH24:MI') hora_buena,
           (select count(*)::int from chk z where z.member_id = a.member_id
              and z.title like '%Meridiano%') checkins_en_meridiano,
           (select count(*)::int from chk z where z.member_id = a.member_id
              and z.title = 'Charla Pedregal Miércoles') checkins_en_pedregal_mie
      from chk a
      join chk b on b.member_id = a.member_id and b.dia = a.dia and b.id <> a.id
      join members m on m.id = a.member_id
     where a.title = 'Charla Pedregal Miércoles'
       and b.title = 'Charla Meridiano Miércoles'
       and b.checked_in_at > a.checked_in_at
       and b.checked_in_at - a.checked_in_at < interval '15 minutes'
     order by a.checked_in_at`)

  console.log(`${rows.length} check-ins en la sede equivocada${APLICAR ? '' : '  (DRY RUN — nada se borra)'}\n`)
  for (const r of rows) {
    console.log(`  ${r.persona}`)
    console.log(`     ${r.hora_mala}  ${r.titulo_malo}   ← se borra`)
    console.log(`        ${r.hora_buena}  ${r.titulo_bueno}   ← se queda`)
    console.log(`     historial: Meridiano ×${r.checkins_en_meridiano} · Pedregal Mié ×${r.checkins_en_pedregal_mie}`)
    console.log(`     id: ${r.id}`)
  }

  /** El guard: si la condición empieza a traer más de lo medido, se para. */
  if (rows.length !== 3) {
    console.error(`\n✗ Se esperaban 3 y vinieron ${rows.length}. Revisar antes de borrar.`)
    await c.end(); process.exit(1)
  }
  if (!APLICAR) { console.log('\nPara aplicar: --aplicar'); await c.end(); return }

  await c.query('begin')
  try {
    const res = await c.query(`delete from event_checkins where id = any($1::uuid[])`,
      [rows.map(r => r.id)])
    if (res.rowCount !== 3) throw new Error(`borró ${res.rowCount}, se esperaban 3`)
    await c.query('commit')
    console.log('\n✓ 3 check-ins borrados')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })

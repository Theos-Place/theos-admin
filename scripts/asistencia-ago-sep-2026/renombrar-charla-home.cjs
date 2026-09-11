/**
 * "Charla Home" es Pedregal Jueves (usuario, 2026-09-11).
 *
 * El problema: charla_sede_code('Charla Home') devuelve NULL, así que ninguno de
 * esos check-ins contaba para asignar sede. No eran los 204 de agosto que
 * reporté — son 73 eventos y 3.006 check-ins desde marzo de 2025, y hay 137
 * personas HOY sin sede que solo asisten ahí.
 *
 * Se renombra en vez de parchear charla_sede_code: el título ES el nombre de la
 * serie en el reporte de asistencia (report_charla_attendance agrupa por
 * e.title), así que dejarlo como "Charla Home" mantendría la historia partida en
 * dos series que son la misma charla. Todos los eventos son jueves — se
 * verificó— , que es lo que el nombre nuevo dice.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const VIEJO='Charla Home', NUEVO='Charla Pedregal Jueves'
const aplicar = process.argv.includes('--aplicar')

;(async()=>{ await c.connect()
  // Guardia: TODOS tienen que ser jueves. Si alguno no lo es, el nombre nuevo
  // mentiría y hay que mirarlo a mano antes de tocar nada.
  const { rows: noJueves } = await c.query(
    `select substr((starts_at at time zone 'America/Costa_Rica')::text,1,10) d,
            to_char(starts_at at time zone 'America/Costa_Rica','Dy') dow
     from events where title=$1 and to_char(starts_at at time zone 'America/Costa_Rica','Dy') <> 'Thu'`, [VIEJO])
  if (noJueves.length) { console.error('ABORTA — hay eventos que no son jueves:', noJueves); process.exit(1) }

  const { rows: [antes] } = await c.query(
    `select count(distinct e.id)::int eventos, count(ck.id)::int checkins
     from events e left join event_checkins ck on ck.event_id=e.id where e.title=$1`, [VIEJO])
  const { rows: [code] } = await c.query(`select charla_sede_code($1) c`, [NUEVO])
  console.log(`${antes.eventos} eventos y ${antes.checkins} check-ins pasan de "${VIEJO}" a "${NUEVO}" (sede: ${code.c})`)

  await c.query('begin')
  const r = await c.query(`update events set title=$2, updated_at=now() where title=$1`, [VIEJO, NUEVO])
  console.log(`eventos renombrados: ${r.rowCount}`)
  const { rows: [q] } = await c.query(
    `select count(*)::int n from event_checkins ck join events e on e.id=ck.event_id
     where e.event_type='charla' and charla_sede_code(e.title) is null`)
  console.log(`check-ins de charla que siguen sin código de sede: ${q.n}`)

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 SIMULACIÓN (rollback).') }
  await c.end()
})().catch(async e=>{ try{await c.query('rollback')}catch{}; console.error(e); process.exit(1) })

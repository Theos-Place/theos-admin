/**
 * Fusiona las dos fichas de Hellen Galeano (2026-09-10).
 *
 * Son la misma persona: misma fecha de nacimiento, mismo comité, y correos que
 * difieren en una ele (galleano / galeano). La segunda es la que ella usa para
 * entrar y la que tiene la cédula y el puesto; la primera es donde vivía todo
 * su historial (23 check-ins, 10 estudios).
 *
 * Se descubrió al asignarle el puesto de Bienvenida en Sede Pérez Zeledón.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const KEEP='8f8d3125-0081-41e5-9755-c61f9b214def'
const DUP ='30c572b4-2c04-483b-820d-2d3a3bb6faa2'
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  await c.query('BEGIN')
  await c.query('select merge_members($1,$2,false)', [KEEP, DUP])
  await c.query('COMMIT')
  console.table((await c.query(`
    select first_name, last_name, cedula, phone, email,
      (select count(*) from event_checkins where member_id=$1)::int checkins,
      (select count(*) from study_enrollments where member_id=$1)::int estudios,
      (select count(*) from member_role_position_grants where member_id=$1)::int respaldos
    from members where id=$1`, [KEEP])).rows)
  console.log('ficha duplicada:', (await c.query('select count(*)::int n from members where id=$1',[DUP])).rows[0].n === 0 ? 'borrada' : 'SIGUE AHÍ')
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

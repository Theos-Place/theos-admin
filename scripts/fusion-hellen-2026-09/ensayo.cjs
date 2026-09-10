// Ensayo de la fusión de las dos fichas de Hellen. Aplica y hace ROLLBACK.
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const KEEP='8f8d3125-0081-41e5-9755-c61f9b214def'  // Hellen Patricia Galeano Solano — cédula, acceso, comité
const DUP ='30c572b4-2c04-483b-820d-2d3a3bb6faa2'  // Hellen Galeano — 23 check-ins, 10 estudios
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const foto = async (t) => (await c.query(`
  select
    (select count(*) from event_checkins    where member_id=$1)::int checkins,
    (select count(*) from study_enrollments where member_id=$1)::int estudios,
    (select count(*) from volunteers        where member_id=$1)::int puestos,
    (select count(*) from member_roles      where member_id=$1)::int roles,
    (select count(*) from member_role_position_grants where member_id=$1)::int respaldos,
    (select count(*) from family_members    where member_id=$1)::int familia,
    (select count(*) from event_registrations where member_id=$1)::int inscripciones`, [t])).rows[0]
;(async()=>{
  await c.connect()
  console.log('ANTES  · queda :', await foto(KEEP))
  console.log('ANTES  · se va :', await foto(DUP))
  console.table((await c.query(`select id, first_name, last_name, cedula, phone, email, birth_date, allergies from members where id in ($1,$2)`,[KEEP,DUP])).rows)
  await c.query('BEGIN')
  try {
    await c.query('select merge_members($1,$2,false)', [KEEP, DUP])
    console.log('\nDESPUÉS · queda :', await foto(KEEP))
    console.table((await c.query(`select first_name, last_name, cedula, phone, email, birth_date from members where id=$1`,[KEEP])).rows)
    console.log('¿sobrevive la ficha duplicada?', (await c.query('select count(*)::int n from members where id=$1',[DUP])).rows[0].n === 0 ? 'no, borrada' : 'SÍ (mal)')
    console.log('respaldos del rol tras fusionar:')
    console.table((await c.query(`select role, position_id from member_role_position_grants where member_id=$1`,[KEEP])).rows)
  } finally { await c.query('ROLLBACK'); await c.end() }
})().catch(e=>{console.error(e.message);process.exit(1)})

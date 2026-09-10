const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const G='f9fb64b1-e42f-4a3f-950e-1200480ac5c7'
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  console.log('— toda tabla con una columna que apunte a study_groups')
  const { rows: cols } = await c.query(`
    select tc.table_name t, kcu.column_name col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
    where tc.constraint_type='FOREIGN KEY' and ccu.table_name='study_groups'`)
  for (const { t, col } of cols) {
    const { rows } = await c.query(`select count(*)::int n from ${t} where ${col}=$1`, [G])
    if (rows[0].n) console.log(`   ${t}.${col}: ${rows[0].n}`)
  }
  console.log('\n— solicitudes de estudio resueltas hacia ese grupo')
  console.table((await c.query(`
    select r.id, m.first_name||' '||m.last_name persona, r.status, r.resulting_enrollment_id,
           to_char(r.reviewed_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') resuelta
    from study_requests r join members m on m.id=r.member_id
    where r.resolved_group_id=$1`, [G])).rows)
  console.log('\n— quién está matriculado hoy, con su pago')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name persona, e.status,
           (select string_agg(p.status||' ₡'||p.amount,', ') from payments p where p.member_id=e.member_id and p.study_group_id=$1) pago
    from study_enrollments e join members m on m.id=e.member_id
    where e.group_id=$1 order by e.created_at`, [G])).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

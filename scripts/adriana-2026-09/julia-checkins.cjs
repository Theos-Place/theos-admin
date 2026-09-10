const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const J='9f228e37-37ec-4fce-8e6b-9c3079055fb4', N='20b02cef-123d-4102-a5ab-4da25f105d95'
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  console.log('— ¿las dos fichas tienen check-in al MISMO evento? (sería duplicado)')
  console.table((await c.query(`
    select count(*)::int eventos_compartidos from (
      select event_id from event_checkins where member_id=$1
      intersect
      select event_id from event_checkins where member_id=$2) t`, [J, N])).rows)
  console.log('— a qué eventos va cada una')
  console.table((await c.query(`
    select e.title, count(*) filter (where ch.member_id=$1)::int julia,
           count(*) filter (where ch.member_id=$2)::int natalia
    from event_checkins ch join events e on e.id=ch.event_id
    where ch.member_id in ($1,$2) group by 1 order by 2 desc, 3 desc limit 12`, [J, N])).rows)
  console.log('— rango de fechas de cada una')
  console.table((await c.query(`
    select case when member_id=$1 then 'Julia (4 años)' else 'Natalia (mamá)' end quien,
           count(*)::int total,
           to_char(min(checked_in_at),'YYYY-MM-DD') desde, to_char(max(checked_in_at),'YYYY-MM-DD') hasta
    from event_checkins where member_id in ($1,$2) group by 1`, [J, N])).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

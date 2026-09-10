const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  const g=(await c.query(`select id, name, to_char(ends_at,'YYYY-MM-DD') termina,
      to_char(closed_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') cerrado,
      to_char(updated_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') updated
    from study_groups where name='Nivel 3. Floriana Fonseca. Junio 2026'`)).rows[0]
  console.log(g)
  console.log('\ninscripciones de ese grupo (la huella del cierre):')
  console.table((await c.query(`select m.first_name||' '||m.last_name persona, e.status, e.notes,
      to_char(coalesce(e.completed_at,e.dropped_at) at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI:SS') sellado
    from study_enrollments e join members m on m.id=e.member_id
    where e.group_id=$1 order by 4 nulls last limit 12`,[g.id])).rows)
  console.log('\nqué tan lejos quedaba updated_at de la verdad, en días:')
  console.table((await c.query(`select width_bucket(extract(day from (updated_at-closed_at))::int, 0, 120, 6) b,
      min(extract(day from (updated_at-closed_at))::int) desde, max(extract(day from (updated_at-closed_at))::int) hasta, count(*)::int grupos
    from study_groups where status='finalizado' and closed_at is not null group by 1 order by 1`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

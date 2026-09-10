// Ensayo de la migración EVE-10: aplica todo y hace ROLLBACK. Solo mide.
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const sql = fs.readFileSync('supabase/migrations/20260910050000_grupos_closed_at.sql','utf8')
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  await c.query('BEGIN')
  try {
    await c.query(sql)
    console.log('— backfill: cuántos grupos finalizados quedaron con fecha')
    console.table((await c.query(`select count(*) filter (where closed_at is not null)::int con_fecha,
      count(*) filter (where closed_at is null)::int sin_fecha from study_groups where status='finalizado'`)).rows)
    console.log('— ¿algún grupo NO finalizado se llevó una fecha por error?')
    console.table((await c.query(`select count(*)::int mal from study_groups where status<>'finalizado' and closed_at is not null`)).rows)
    console.log('— los sin fecha, por año de fin (deberían ser el histórico de CCB)')
    console.table((await c.query(`select coalesce(to_char(ends_at,'YYYY'),'sin fecha') ano, count(*)::int n
      from study_groups where status='finalizado' and closed_at is null group by 1 order by 1`)).rows)
    console.log('— muestra de fechas backfilleadas vs updated_at (por qué updated_at no servía)')
    console.table((await c.query(`select name, to_char(closed_at,'YYYY-MM-DD') cerrado, to_char(updated_at,'YYYY-MM-DD') updated,
      (closed_at::date <> updated_at::date) difieren from study_groups
      where status='finalizado' and closed_at is not null order by closed_at desc limit 8`)).rows)
    console.log('— cuántos difieren de updated_at en total')
    console.table((await c.query(`select count(*) filter (where closed_at::date <> updated_at::date)::int difieren,
      count(*)::int total from study_groups where status='finalizado' and closed_at is not null`)).rows)
  } finally {
    await c.query('ROLLBACK'); await c.end()
  }
})().catch(e=>{console.error(e.message);process.exit(1)})

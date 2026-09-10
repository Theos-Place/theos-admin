const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const V='20260910090000', F=`supabase/migrations/${V}_charla_por_calidad.sql`
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  const antes = (await c.query(`select sum(checkins)::int total from report_charla_attendance()`)).rows[0].total
  await c.query('BEGIN')
  await c.query(fs.readFileSync(F,'utf8'))
  await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1,$2) on conflict (version) do nothing`, [V,'charla_por_calidad'])
  const despues = (await c.query(`select sum(checkins)::int total from report_charla_attendance()`)).rows[0].total
  console.log(`total de check-ins antes ${antes} · después ${despues} · ${antes === despues ? '✓ igual' : '✗ CAMBIÓ'}`)
  if (antes !== despues) { await c.query('ROLLBACK'); throw new Error('el total cambió, no se aplica') }
  await c.query('COMMIT')
  console.log('\nmuestra de la semana 37 de 2026:')
  console.table((await c.query(`select title, wk, calidad, checkins from report_charla_attendance() where yr=2026 and wk=37 order by 4 desc limit 8`)).rows)
  await c.end()
})().catch(e=>{console.error('✗', e.message);process.exit(1)})

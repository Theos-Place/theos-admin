const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  console.log('— fichas ACTIVAS con fecha de nacimiento imposible (menos de 4 años o año absurdo)')
  console.table((await c.query(`
    select count(*)::int total,
           count(*) filter (where extract(year from age(birth_date)) < 1)::int menos_de_1,
           count(*) filter (where extract(year from age(birth_date)) between 1 and 3)::int entre_1_y_3,
           count(*) filter (where birth_date < '1900-01-01')::int año_absurdo
    from members where is_active and birth_date is not null
      and (extract(year from age(birth_date)) < 4 or birth_date < '1900-01-01')`)).rows)
  console.log('— niños de 4 a 11 (los que se dejaron a propósito)')
  console.table((await c.query(`
    select count(*)::int ninos_4_a_11 from members
    where is_active and birth_date is not null and extract(year from age(birth_date)) between 4 and 11`)).rows)
  console.log('— ¿quedó Adolfo Guiso con el año 1194?')
  console.table((await c.query(`select first_name, last_name, birth_date from members where last_name ilike '%guiso%'`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

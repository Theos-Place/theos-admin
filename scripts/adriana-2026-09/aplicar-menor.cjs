const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const V='20260910080000', F=`supabase/migrations/${V}_menor_datos_protegidos.sql`
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect(); await c.query('BEGIN')
  await c.query(fs.readFileSync(F,'utf8'))
  await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1,$2) on conflict (version) do nothing`, [V,'menor_datos_protegidos'])
  await c.query('COMMIT')
  console.table((await c.query(`select conname from pg_constraint where conrelid='members'::regclass and conname like '%datos_protegidos%'`)).rows)
  console.log('fichas marcadas hoy:', (await c.query(`select count(*)::int n from members where datos_protegidos`)).rows[0].n)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const V='20260910060000', F=`supabase/migrations/${V}_pago_traza_de_traslado.sql`
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect(); await c.query('BEGIN')
  await c.query(fs.readFileSync(F,'utf8'))
  await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1,$2) on conflict (version) do nothing`, [V,'pago_traza_de_traslado'])
  await c.query('COMMIT')
  console.table((await c.query(`select column_name, data_type from information_schema.columns where table_name='payments' and column_name='transfer_note'`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

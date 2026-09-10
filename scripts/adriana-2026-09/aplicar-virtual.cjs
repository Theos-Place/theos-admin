const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const V='20260910070000', F=`supabase/migrations/${V}_virtual_con_justificacion.sql`
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect(); await c.query('BEGIN')
  await c.query(fs.readFileSync(F,'utf8'))
  await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1,$2) on conflict (version) do nothing`, [V,'virtual_con_justificacion'])
  await c.query('COMMIT')
  console.table((await c.query(`select column_name from information_schema.columns where table_name='member_admin_data' and column_name like 'authorized_virtual%'`)).rows)
  console.log('personas ya autorizadas (quedan sin razón, es dato viejo):')
  console.table((await c.query(`select count(*)::int autorizadas from member_admin_data where authorized_virtual_studies`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  console.log('hora del servidor:', (await c.query(`select now() at time zone 'America/Costa_Rica' ahora_cr`)).rows[0].ahora_cr)
  console.log('\n— la ficha: cuándo se tocó por última vez y qué campo')
  console.table((await c.query(`
    select to_char(created_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') creada,
           to_char(updated_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') actualizada,
           field_updated_at
    from members where id='f73ad5f5-b96a-4f53-9d3b-e2270c542119'`)).rows)
  console.log('\n— los intentos, en hora de Costa Rica y con el texto exacto que escribió')
  console.table((await c.query(`
    select to_char(created_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') cuando,
           recipient, status, last_error
    from message_logs where recipient ilike '%valdiviezo%' order by created_at desc limit 10`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

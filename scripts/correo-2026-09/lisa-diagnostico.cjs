const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  console.log('— los bytes exactos del correo guardado')
  console.table((await c.query(`
    select id, email, length(email) largo, encode(convert_to(email,'UTF8'),'hex') hex
    from members where email ilike '%lisavaldiviezo%'`)).rows)
  console.log('— ¿lo encuentra un ILIKE con el texto exacto?')
  console.table((await c.query(`
    select count(*)::int encontradas from members where email ilike $1`,
    ['lisavaldiviezo@hotmail.com'])).rows)
  console.log('— ¿y cuántas fichas tienen ESE correo? (el .limit(1) toma una sola)')
  console.table((await c.query(`
    select id, first_name, last_name, email, auth_user_id is not null tiene_cuenta
    from members where lower(btrim(email)) = 'lisavaldiviezo@hotmail.com'`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

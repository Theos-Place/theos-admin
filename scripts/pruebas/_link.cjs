const { Client } = require('pg'); const fs=require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{ await c.connect()
console.log('— ¿se creó la cuenta de Auth con su correo?')
console.table((await c.query(`select id, email, to_char(created_at,'HH24:MI:SS') creada, email_confirmed_at is not null confirmado
 from auth.users where lower(email)='vitos_78@hotmail.com'`)).rows)
console.log('\n— ¿es normal que auth_user_id quede null? cuántos hay así con cuenta creada:')
console.table((await c.query(`select count(*)::int fichas_sin_enlazar_con_cuenta_existente
 from members m join auth.users u on lower(u.email)=lower(m.email) where m.auth_user_id is null`)).rows)
console.log('\n— ¿hay trigger o función que enlace al entrar?')
console.log((await c.query(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and pg_get_functiondef(p.oid) ilike '%auth_user_id%'`)).rows.map(r=>r.proname).join(', ') || 'ninguna')
await c.end() })()

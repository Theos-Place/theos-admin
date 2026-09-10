const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  console.log('— menores de 12 CON cédula (¿es la del papá, como pasó con Julia?)')
  console.table((await c.query(`
    select m.id, m.first_name||' '||m.last_name nino, extract(year from age(m.birth_date))::int edad,
           m.cedula, m.email,
           exists (select 1 from family_members f where f.member_id=m.id) en_familia
    from members m where m.is_active and m.birth_date is not null
      and extract(year from age(m.birth_date)) < 12 and m.cedula is not null`)).rows)
  console.log('\n— menores de 12 cuyo correo comparte un ADULTO (el caso de Julia)')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name nino, extract(year from age(m.birth_date))::int edad, m.email,
           (select string_agg(o.first_name||' '||o.last_name, ', ') from members o
             where o.id <> m.id and lower(o.email)=lower(m.email)) adultos_con_ese_correo
    from members m where m.is_active and m.email is not null and m.birth_date is not null
      and extract(year from age(m.birth_date)) < 12
      and exists (select 1 from members o where o.id <> m.id and lower(o.email)=lower(m.email)
                    and extract(year from age(o.birth_date)) >= 18)`)).rows)
  console.log('\n— y los menores de 12 CON cuenta de acceso, en todo el padrón')
  console.table((await c.query(`
    select count(*)::int menores_con_cuenta from members
    where birth_date is not null and extract(year from age(birth_date)) < 12 and auth_user_id is not null`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

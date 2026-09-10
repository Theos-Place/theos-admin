/**
 * Menores de 12 con correo: normalmente es el del papá o la mamá, puesto
 * porque el formulario lo pedía. Antes de quitarlo hay que ver DOS cosas:
 * que el niño esté en una familia, y de quién es ese correo en realidad.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  const base = `
    from members m
    where m.is_active and m.email is not null and m.birth_date is not null
      and extract(year from age(m.birth_date)) < 12`
  console.log('— cuántos son')
  console.table((await c.query(`select count(*)::int menores_de_12_con_correo ${base}`)).rows)

  console.log('\n— ¿están en una familia?')
  console.table((await c.query(`
    select count(*) filter (where exists (select 1 from family_members f where f.member_id=m.id))::int con_familia,
           count(*) filter (where not exists (select 1 from family_members f where f.member_id=m.id))::int SIN_familia
    ${base}`)).rows)

  console.log('\n— ¿de quién es el correo?')
  console.table((await c.query(`
    select
      count(*) filter (where exists (
        select 1 from members o where o.id <> m.id and lower(o.email)=lower(m.email)
          and extract(year from age(o.birth_date)) >= 18))::int lo_comparte_un_adulto,
      count(*) filter (where m.auth_user_id is not null)::int con_cuenta_de_acceso,
      count(*) filter (where m.cedula is not null)::int con_cedula
    ${base}`)).rows)

  console.log('\n— los que TIENEN cuenta de acceso (esos hay que mirarlos uno a uno)')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name nino, extract(year from age(m.birth_date))::int edad,
           m.email, m.auth_user_id is not null cuenta,
           exists (select 1 from family_members f where f.member_id=m.id) en_familia
    ${base} and m.auth_user_id is not null order by 2`)).rows)

  console.log('\n— muestra de los que NO están en ninguna familia')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name nino, extract(year from age(m.birth_date))::int edad, m.email
    ${base} and not exists (select 1 from family_members f where f.member_id=m.id)
    order by 2 limit 12`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

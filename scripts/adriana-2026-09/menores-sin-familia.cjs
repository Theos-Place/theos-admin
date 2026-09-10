/**
 * Los 59 menores de 12 con correo y SIN familia: ¿qué evidencia hay de quién
 * es su papá o su mamá? Solo mide. No vincula nada.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const SIN_FAMILIA = `
  from members m
  where m.is_active and m.email is not null and m.birth_date is not null
    and extract(year from age(m.birth_date)) < 12
    and not exists (select 1 from family_members f where f.member_id = m.id)`
;(async()=>{
  await c.connect()
  console.log('— total'); console.table((await c.query(`select count(*)::int n ${SIN_FAMILIA}`)).rows)

  console.log('\n— señal 1: un ADULTO con el MISMO correo (el papá dio el suyo)')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name nino, extract(year from age(m.birth_date))::int edad, m.email,
           (select string_agg(a.first_name||' '||a.last_name, ' / ') from members a
             where a.id<>m.id and lower(a.email)=lower(m.email)
               and a.birth_date is not null and extract(year from age(a.birth_date))>=18) adulto
    ${SIN_FAMILIA}
      and exists (select 1 from members a where a.id<>m.id and lower(a.email)=lower(m.email)
                    and a.birth_date is not null and extract(year from age(a.birth_date))>=18)
    order by 2`)).rows)

  console.log('\n— señal 2: un adulto con el mismo TELÉFONO')
  console.table((await c.query(`
    select count(*)::int con_telefono_de_un_adulto ${SIN_FAMILIA}
      and m.phone is not null
      and exists (select 1 from members a where a.id<>m.id and a.phone=m.phone
                    and a.birth_date is not null and extract(year from age(a.birth_date))>=18)`)).rows)

  console.log('\n— señal 3: alguien con el MISMO apellido que sí tiene familia')
  console.table((await c.query(`
    select count(*)::int con_apellido_en_una_familia ${SIN_FAMILIA}
      and exists (
        select 1 from members a join family_members f on f.member_id=a.id
        where a.id<>m.id and a.birth_date is not null and extract(year from age(a.birth_date))>=18
          and lower(split_part(a.last_name,' ',1)) = lower(split_part(m.last_name,' ',1)))`)).rows)

  console.log('\n— cuántos NO tienen ninguna de las tres señales')
  console.table((await c.query(`
    select count(*)::int sin_ninguna_senal ${SIN_FAMILIA}
      and not exists (select 1 from members a where a.id<>m.id and lower(a.email)=lower(m.email)
                        and a.birth_date is not null and extract(year from age(a.birth_date))>=18)
      and not exists (select 1 from members a where a.id<>m.id and m.phone is not null and a.phone=m.phone
                        and a.birth_date is not null and extract(year from age(a.birth_date))>=18)
      and not exists (select 1 from members a join family_members f on f.member_id=a.id
                        where a.id<>m.id and a.birth_date is not null and extract(year from age(a.birth_date))>=18
                          and lower(split_part(a.last_name,' ',1)) = lower(split_part(m.last_name,' ',1)))`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

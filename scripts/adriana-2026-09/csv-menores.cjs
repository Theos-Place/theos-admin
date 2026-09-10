/**
 * CSV de los menores de 12 con correo y SIN familia, con la evidencia de quién
 * podría ser su papá o su mamá — para que en sede lo confirmen.
 *
 * La columna QUE_TAN_SEGURO dice qué tan buena es la pista, para que nadie
 * vincule a ciegas: un apellido compartido NO es evidencia (hay cientos de
 * Rodríguez), un teléfono compartido sí, y las dos juntas casi seguro.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const csv = v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s }
;(async()=>{
  await c.connect()
  const { rows } = await c.query(`
    with menores as (
      select m.id, m.first_name||' '||m.last_name nombre,
             extract(year from age(m.birth_date))::int edad, m.birth_date, m.email, m.phone,
             lower(split_part(m.last_name,' ',1)) ap1, lower(split_part(m.last_name,' ',2)) ap2
      from members m
      where m.is_active and m.email is not null and m.birth_date is not null
        and extract(year from age(m.birth_date)) < 12
        and not exists (select 1 from family_members f where f.member_id = m.id)
    )
    select n.*,
      (select string_agg(a.first_name||' '||a.last_name,' | ') from members a
        where a.id<>n.id and lower(a.email)=lower(n.email)
          and a.birth_date is not null and extract(year from age(a.birth_date))>=18) adulto_mismo_correo,
      (select string_agg(a.first_name||' '||a.last_name,' | ') from members a
        where a.id<>n.id and n.phone is not null and a.phone=n.phone
          and a.birth_date is not null and extract(year from age(a.birth_date))>=18) adulto_mismo_telefono,
      (select string_agg(distinct a.first_name||' '||a.last_name,' | ') from members a
        join family_members f on f.member_id=a.id
        where a.id<>n.id and a.birth_date is not null and extract(year from age(a.birth_date))>=18
          and (lower(split_part(a.last_name,' ',1)) = n.ap1
            or (n.ap2 <> '' and lower(split_part(a.last_name,' ',1)) = n.ap2))) adultos_mismo_apellido
    from menores n order by n.edad, n.nombre`)

  const filas = rows.map(r => {
    const correo = !!r.adulto_mismo_correo, tel = !!r.adulto_mismo_telefono
    const seguro = (correo && tel) ? 'MUY ALTA (correo y teléfono)'
      : correo ? 'ALTA (correo compartido)'
      : tel ? 'ALTA (teléfono compartido)'
      : r.adultos_mismo_apellido ? 'BAJA — solo el apellido, hay que preguntar'
      : 'NINGUNA — no hay pista, hay que preguntar'
    return {
      QUE_TAN_SEGURO: seguro,
      NINO: r.nombre, EDAD: r.edad, NACE: r.birth_date instanceof Date ? r.birth_date.toISOString().slice(0,10) : String(r.birth_date).slice(0,10),
      CORREO_EN_SU_FICHA: r.email, TELEFONO: r.phone ?? '',
      ADULTO_MISMO_CORREO: r.adulto_mismo_correo ?? '',
      ADULTO_MISMO_TELEFONO: r.adulto_mismo_telefono ?? '',
      ADULTOS_MISMO_APELLIDO: (r.adultos_mismo_apellido ?? '').split(' | ').slice(0,4).join(' | '),
      ID_DEL_NINO: r.id,
    }
  })
  const orden = ['MUY ALTA','ALTA (correo','ALTA (tel','BAJA','NINGUNA']
  filas.sort((a,b) => orden.findIndex(o=>a.QUE_TAN_SEGURO.startsWith(o)) - orden.findIndex(o=>b.QUE_TAN_SEGURO.startsWith(o)))
  const cols = Object.keys(filas[0])
  const salida = [cols.join(','), ...filas.map(f => cols.map(k => csv(f[k])).join(','))].join('\n')
  fs.writeFileSync('scripts/output/menores-sin-familia.csv', '﻿' + salida)
  console.log(`✓ ${filas.length} filas → scripts/output/menores-sin-familia.csv`)
  const por = {}
  for (const f of filas) { const k = f.QUE_TAN_SEGURO.split(' —')[0]; por[k] = (por[k] ?? 0) + 1 }
  console.table(Object.entries(por).map(([k,v]) => ({ que_tan_seguro: k, cuantos: v })))
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})

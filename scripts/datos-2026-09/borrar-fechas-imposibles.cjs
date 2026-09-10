/**
 * DAT-1 · Borrar SOLO las fechas de nacimiento genuinamente imposibles.
 *
 * El plan original decía "65 fichas con fecha imposible", contando a todo el que
 * dijera 3 años o menos. ESA PREMISA ESTABA MAL: registrar niños chiquitos es
 * normal acá —452 personas de 4 a 11 años en el padrón—, y de esas 65, 41 están
 * en una familia, 34 como "Hijo/a", ninguna tiene cuenta de acceso y solo 2
 * tienen cédula. Son los chiquitos que llegan con sus papás. Borrarles la fecha
 * habría destruido datos reales.
 *
 * Se borran solo aquellas donde la edad CONTRADICE otro dato de la propia ficha,
 * que es lo único que prueba el error sin adivinar:
 *   · año anterior a 1900;
 *   · figura como CÓNYUGE de alguien con 1-3 años;
 *   · está MATRICULADA en un estudio con 1-3 años;
 *   · tiene cuenta de acceso o sirve como voluntaria con 1-3 años.
 *
 * Se pone null y no una fecha inventada: null dice "no sabemos", que es cierto.
 * El año está mal digitado y no hay de dónde deducir el bueno — "2 años" pudo
 * ser 1970 igual que 1995.
 *
 *   node scripts/datos-2026-09/borrar-fechas-imposibles.cjs
 *   node scripts/datos-2026-09/borrar-fechas-imposibles.cjs --aplicar
 */
const { Client } = require('pg'); const fs = require('fs'); const path = require('path')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const aplicar = process.argv.includes('--aplicar')

const CRITERIO = `
  m.is_active and m.birth_date is not null
  and (extract(year from age(m.birth_date)) <= 3 or m.birth_date < '1900-01-01')
  and (
    m.birth_date < '1900-01-01'
    or m.auth_user_id is not null
    or exists (select 1 from family_members fm where fm.member_id = m.id and fm.relation = 'Cónyuge')
    or exists (select 1 from volunteers v where v.member_id = m.id)
    or exists (select 1 from study_enrollments e where e.member_id = m.id)
  )`

;(async () => {
  await c.connect()
  const { rows } = await c.query(`
    select m.id, trim(m.first_name||' '||m.last_name) nombre,
      to_char(m.birth_date,'YYYY-MM-DD') fecha, extract(year from age(m.birth_date))::int edad,
      m.cedula, m.email,
      case
        when m.birth_date < '1900-01-01' then 'año imposible'
        when exists (select 1 from family_members fm where fm.member_id=m.id and fm.relation='Cónyuge') then 'figura como cónyuge'
        when m.auth_user_id is not null then 'tiene cuenta de acceso'
        when exists (select 1 from volunteers v where v.member_id=m.id) then 'sirve como voluntaria'
        else 'matriculada en estudios'
      end motivo
    from members m where ${CRITERIO} order by m.birth_date`)

  console.log(`fichas donde la edad contradice otro dato de la propia ficha: ${rows.length}\n`)
  console.table(rows.map(r => ({ persona: r.nombre, fecha: r.fecha, edad: r.edad, motivo: r.motivo })))

  // Comprobación de que NO se tocan los niños: se cuenta lo que queda fuera.
  const { rows: [fuera] } = await c.query(`
    select count(*)::int n from members m
    where m.is_active and m.birth_date is not null
      and extract(year from age(m.birth_date)) <= 3 and m.birth_date >= '1900-01-01'
      and not (${CRITERIO.replace(/^\s*m\.is_active[^]*?and \(\s*/, '(')})`)
  console.log(`\nquedan intactas ${fuera.n} fichas de niños sin contradicción — NO se tocan`)

  if (!aplicar) { console.log('\nSIMULACRO. Volvé a correrlo con --aplicar.'); await c.end(); return }

  // El respaldo se escribe ANTES del UPDATE: si algo falla, queda constancia.
  const respaldo = path.join('scripts/datos-2026-09', 'fechas-borradas.csv')
  fs.writeFileSync(respaldo, ['id,nombre,fecha_borrada,edad_calculada,motivo,cedula,email',
    ...rows.map(r => [r.id, `"${r.nombre}"`, r.fecha, r.edad, `"${r.motivo}"`, r.cedula ?? '', r.email ?? ''].join(','))].join('\n'))
  console.log(`\nrespaldo: ${respaldo}`)

  const upd = await c.query(`update members set birth_date = null where id = any($1) returning id`,
    [rows.map(r => r.id)])
  console.log(`fechas borradas: ${upd.rowCount}`)

  const { rows: [check] } = await c.query(`
    select count(*)::int n from members m where ${CRITERIO}`)
  console.log(`quedan con contradicción: ${check.n}`)
  const { rows: [ninos] } = await c.query(`
    select count(*)::int n from members where is_active and birth_date is not null
      and extract(year from age(birth_date)) <= 3`)
  console.log(`niños de 3 años o menos que siguen con su fecha: ${ninos.n}`)
  await c.end()
})()

/**
 * Quitarle el correo a los menores de 12 que están en una familia.
 *
 * POR QUÉ. Normalmente ese correo es el del papá o la mamá, puesto porque el
 * formulario lo pedía. Un menor de 12 no lleva cuenta de acceso (AUTH-1), así
 * que el correo no le sirve para nada suyo — y sí sirve para confundir: en el
 * caso de Julia Barrantes, la mamá terminó entrando al sistema con el perfil
 * de su hija.
 *
 * SOLO a los que están en una FAMILIA. A los que no, quitarles el correo los
 * deja sin ninguna forma de contacto; esos hay que vincularlos primero.
 *
 *   node scripts/adriana-2026-09/limpiar-correos-menores.cjs
 *   node scripts/adriana-2026-09/limpiar-correos-menores.cjs --aplicar
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const aplicar = process.argv.includes('--aplicar')
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})

const CANDIDATOS = `
  from members m
  where m.is_active and m.email is not null and m.birth_date is not null
    and extract(year from age(m.birth_date)) < 12
    and m.auth_user_id is null                      -- ninguno tiene, pero si alguno apareciera NO se toca
    and exists (select 1 from family_members f where f.member_id = m.id)`

;(async()=>{
  await c.connect()
  console.log('— a quiénes se les quita (menores de 12, en familia, sin cuenta)')
  const { rows } = await c.query(`
    select m.id, m.first_name||' '||m.last_name nino, extract(year from age(m.birth_date))::int edad,
           m.email, (select relation from family_members f where f.member_id=m.id limit 1) relacion
    ${CANDIDATOS} order by 3`)
  console.table(rows.slice(0, 15))
  if (rows.length > 15) console.log(`   … y ${rows.length - 15} más`)
  console.log(`\ntotal: ${rows.length}`)

  console.log('\n— NO se tocan: los que no están en ninguna familia')
  console.table((await c.query(`
    select count(*)::int sin_familia from members m
    where m.is_active and m.email is not null and m.birth_date is not null
      and extract(year from age(m.birth_date)) < 12
      and not exists (select 1 from family_members f where f.member_id = m.id)`)).rows)

  if (!aplicar) { console.log('\nEnsayo. Volvé a correrlo con --aplicar.'); await c.end(); return }
  const r = await c.query(`update members set email = null, updated_at = now() where id = any($1)`,
    [rows.map(x => x.id)])
  console.log(`\n✓ ${r.rowCount} correos quitados`)
  console.table((await c.query(`
    select count(*)::int quedan_con_correo from members m
    where m.is_active and m.email is not null and m.birth_date is not null
      and extract(year from age(m.birth_date)) < 12`)).rows)
  await c.end()
})().catch(e=>{console.error('✗', e.message);process.exit(1)})

/**
 * Julia Barrantes Soto cargaba el correo y la cédula de su MAMÁ, Natalia Soto
 * Ocampo, así que la cuenta entraba al sistema mostrando el perfil de la hija.
 *
 * Se le devuelven a Natalia sus tres cosas: correo, cédula y la cuenta de
 * acceso. Julia queda como lo que es —una niña de 4 años— sin correo, sin
 * cédula y sin login. Y Natalia entra a la familia como Madre: hoy esa familia
 * tiene dos hijas y ningún adulto.
 *
 * NO se tocan los check-ins de ninguna de las dos. Ver la nota del final.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const J='9f228e37-37ec-4fce-8e6b-9c3079055fb4'
const N='20b02cef-123d-4102-a5ab-4da25f105d95'
const FAM='cae4d600-9165-4a2f-80bf-5400806fd6bb'
const aplicar = process.argv.includes('--aplicar')
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})

const foto = async () => (await c.query(`
  select m.first_name||' '||m.last_name persona, m.birth_date nace, m.email, m.cedula,
         m.auth_user_id is not null cuenta,
         (select relation from family_members f where f.member_id=m.id and f.family_unit_id=$3) en_la_familia
  from members m where m.id in ($1,$2) order by m.birth_date nulls first`, [J, N, FAM])).rows

;(async()=>{
  await c.connect()
  console.log('ANTES'); console.table(await foto())
  await c.query('BEGIN')
  try {
    // El ORDEN importa: auth_user_id es único, así que hay que soltarlo de
    // Julia antes de dárselo a Natalia o el update rebota.
    const { rows: [suyo] } = await c.query(
      `select email, cedula, document_type, auth_user_id from members where id=$1`, [J])

    // 1. Julia queda como la niña de 4 años que es.
    const r2 = await c.query(`
      update members set email=null, cedula=null, document_type='cedula', auth_user_id=null, updated_at=now()
      where id=$1`, [J])
    // 2. Lo de la mamá, a la mamá.
    const r1 = await c.query(`
      update members set email=$2, cedula=$3, document_type=$4, auth_user_id=$5, updated_at=now()
      where id=$1`, [N, suyo.email, suyo.cedula, suyo.document_type, suyo.auth_user_id])
    // 3. La mamá entra a la familia de sus hijas.
    const r3 = await c.query(`
      insert into family_members (family_unit_id, member_id, relation)
      values ($1,$2,'Madre') on conflict do nothing`, [FAM, N])
    if (r1.rowCount !== 1 || r2.rowCount !== 1) throw new Error(`filas raras: ${r1.rowCount}/${r2.rowCount}`)
    console.log(`\nDESPUÉS (familia: ${r3.rowCount ? 'Natalia agregada como Madre' : 'ya estaba'})`)
    console.table(await foto())
    if (aplicar) { await c.query('COMMIT'); console.log('\n✓ aplicado') }
    else { await c.query('ROLLBACK'); console.log('\nEnsayo. Volvé a correrlo con --aplicar.') }
  } catch (e) { await c.query('ROLLBACK'); throw e }
  finally { await c.end() }
})().catch(e=>{console.error('✗', e.message);process.exit(1)})

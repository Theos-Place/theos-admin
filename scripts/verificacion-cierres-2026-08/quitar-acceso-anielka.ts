/**
 * Borra la CUENTA DE ACCESO de Anielka Herrera Mairena, no su ficha
 * (autorizado por el usuario, 2026-09-01).
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/quitar-acceso-anielka.ts
 *   aplicar:  ... --aplicar
 *
 * Su cuenta quedó con el correo de OTRA persona: naomi_sasso@hotmail.com. No es
 * teórico — alguien entró con ella el 1/9 a las 8:37 y aterrizó en el perfil de
 * Anielka. Cuatro minutos después, la misma persona entró con su propia cuenta
 * (naomisasso@gmail.com, ficha de Naomi Sasso Kessler), que funciona bien.
 *
 * La ficha de Anielka NO se toca: tiene 6 matrículas. Y no tiene correo propio,
 * así que no queda nada suelto por limpiar — al desligarla queda como cualquier
 * otra persona sin cuenta, y se le puede crear una cuando dé su correo.
 *
 * Se verifica ANTES de borrar que la cuenta no sea de nadie más y que Naomi
 * conserve la suya: borrar la única cuenta de alguien por error no se deshace.
 */
import { writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const FICHA = 'a4268160-3e03-4419-9b31-f2a8384dd422'   // Anielka Herrera Mairena
const CUENTA = '66fb4e21-2ec1-45bb-8aa1-c08945bc2b3a'  // la que lleva el correo de Naomi
const CORREO_AJENO = 'naomi_sasso@hotmail.com'

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows: [f] } = await c.query(
    `select id, first_name||' '||last_name nombre, email, auth_user_id,
       (select count(*) from study_enrollments e where e.member_id=m.id) matriculas
     from members m where id=$1`, [FICHA])
  const { rows: [u] } = await c.query(
    `select id, email, (select count(*) from members m where m.auth_user_id=u.id) fichas
     from auth.users u where id=$1`, [CUENTA])
  const { rows: [naomi] } = await c.query(
    `select m.first_name||' '||m.last_name nombre, m.email, u.id cuenta, u.last_sign_in_at
     from members m join auth.users u on u.id=m.auth_user_id
     where lower(m.email)='naomisasso@gmail.com'`)

  console.log(`ficha  : ${f?.nombre} · correo ${f?.email ?? '(ninguno)'} · ${f?.matriculas} matrículas  → NO se toca`)
  console.log(`cuenta : ${u?.email} · ligada a ${u?.fichas} ficha(s)  → se borra`)
  console.log(`Naomi  : ${naomi?.nombre ?? '—'} conserva ${naomi?.cuenta ? `su cuenta (${naomi.email})` : 'NADA'}`)

  // Guardas: si alguna falla, no se borra nada.
  const problemas: string[] = []
  if (!f) problemas.push('la ficha no existe')
  if (!u) problemas.push('la cuenta no existe')
  if (f?.auth_user_id !== CUENTA) problemas.push('la ficha no está ligada a esa cuenta')
  if (String(u?.email).toLowerCase() !== CORREO_AJENO) problemas.push(`la cuenta ya no tiene el correo ${CORREO_AJENO}`)
  if (Number(u?.fichas) !== 1) problemas.push('esa cuenta está ligada a más de una ficha')
  if (!naomi?.cuenta) problemas.push('Naomi se quedaría sin cuenta propia')
  if (problemas.length) { console.log('\n⛔ ' + problemas.join('\n⛔ ')); await c.end(); process.exit(1) }
  console.log('\n✓ todas las verificaciones pasan')

  if (!APLICAR) { console.log('\n(dry-run) borraría la cuenta y dejaría la ficha sin acceso.'); await c.end(); return }

  const { rows: respaldo } = await c.query(
    `select u.id, u.email, u.created_at, u.last_sign_in_at, u.encrypted_password,
       (select jsonb_agg(i) from auth.identities i where i.user_id=u.id) identities
     from auth.users u where u.id=$1`, [CUENTA])
  writeFileSync('scripts/output/anielka-acceso-2026-09-01-antes.json',
    JSON.stringify({ ficha: f, cuenta: respaldo[0] }, null, 2))
  console.log('respaldo → scripts/output/anielka-acceso-2026-09-01-antes.json')

  await c.query('begin')
  await c.query('update members set auth_user_id=null, updated_at=now() where id=$1', [FICHA])
  await c.query('delete from auth.identities where user_id=$1', [CUENTA])
  await c.query('delete from auth.users where id=$1', [CUENTA])
  await c.query('commit')
  console.log('✓ cuenta borrada y ficha desligada')

  const { rows: fin } = await c.query(
    `select (select count(*) from auth.users where id=$1) cuenta_existe,
            (select auth_user_id is null from members where id=$2) ficha_sin_acceso,
            (select count(*) from study_enrollments where member_id=$2) matriculas,
            (select count(*) from auth.users where lower(email)='naomisasso@gmail.com') naomi_ok`,
    [CUENTA, FICHA])
  console.log('verificación:', JSON.stringify(fin[0]))
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })

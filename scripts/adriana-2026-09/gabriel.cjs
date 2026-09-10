/**
 * Gabriel Álvarez Gómez entró al sistema pero no le aparecía su perfil ni el
 * acceso al check-in.
 *
 * QUÉ PASÓ. Tiene DOS fichas con el mismo correo y la misma cédula (una activa
 * con sus roles y su puesto, otra inactiva). Al pedir su contraseña se le creó
 * la cuenta de Auth, pero el enlace automático NO la ató a ninguna ficha: la
 * regla de planDeEnlace se niega a adivinar cuando dos fichas comparten el
 * correo, justamente para no atar la cuenta a la persona equivocada.
 *
 * O sea que la regla hizo lo correcto. El problema de fondo es el duplicado.
 *
 *   node scripts/adriana-2026-09/gabriel.cjs            (ensayo)
 *   node scripts/adriana-2026-09/gabriel.cjs --aplicar
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const KEEP='0086a1a9-5b82-4951-80c5-478bcf642e84'   // activa, con roles y puesto
const DUP ='450d3767-6b59-478d-895b-be24cbdd960d'   // inactiva
const AUTH='31f9c48e-8f1d-440c-95bd-f1812ae355f5'
const aplicar = process.argv.includes('--aplicar')
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const foto = async () => (await c.query(`
  select m.id, m.is_active activa, m.auth_user_id is not null cuenta,
    (select count(*) from member_roles r where r.member_id=m.id and r.is_active)::int roles,
    (select count(*) from volunteers v where v.member_id=m.id and v.status='active')::int puestos,
    (select count(*) from event_checkins e where e.member_id=m.id)::int checkins,
    (select count(*) from study_enrollments s where s.member_id=m.id)::int estudios
  from members m where m.id in ($1,$2)`, [KEEP, DUP])).rows
;(async()=>{
  await c.connect()
  console.log('ANTES'); console.table(await foto())
  await c.query('BEGIN')
  try {
    await c.query('select merge_members($1,$2,false)', [KEEP, DUP])
    await c.query(`update members set auth_user_id=$1, updated_at=now() where id=$2 and auth_user_id is null`, [AUTH, KEEP])
    console.log('DESPUÉS')
    console.table((await c.query(`
      select m.first_name||' '||m.last_name persona, m.is_active activa, m.auth_user_id is not null cuenta,
        (select string_agg(r.role,', ') from member_roles r where r.member_id=m.id and r.is_active) roles,
        (select count(*) from volunteers v where v.member_id=m.id and v.status='active')::int puestos
      from members m where m.id=$1`, [KEEP])).rows)
    console.log('¿la ficha duplicada?', (await c.query('select count(*)::int n from members where id=$1',[DUP])).rows[0].n === 0 ? 'borrada' : 'SIGUE')
    if (aplicar) { await c.query('COMMIT'); console.log('\n✓ aplicado') }
    else { await c.query('ROLLBACK'); console.log('\nEnsayo. Volvé a correrlo con --aplicar.') }
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { await c.end() }
})().catch(e=>{console.error('✗', e.message);process.exit(1)})

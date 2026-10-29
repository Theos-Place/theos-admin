/**
 * Dos pedidos de Floriana (28/10/2026):
 *   1. El Nivel 4 de octubre 2026 se llama solo por Tatiana (Marco salió hoy).
 *   2. Santiago Conejo Rodríguez perdió el acceso a santiagoconejor@hotmail.com;
 *      el correo pasa a santiagoconejor@gmail.com en la ficha Y en el login
 *      (Auth), como hace mergeMembersResuelto: updateUserById + email_confirm.
 *
 *   node scripts/finanzas-2026-10-28/grupo-tatiana-y-correo-santiago.cjs [--aplicar]
 */
const fs = require('node:fs')
const { createClient } = require('@supabase/supabase-js')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const GRUPO = 'a9180796-4c23-4d43-96cf-857471cba22a'
const NOMBRE_NUEVO = 'Nivel 4. Tatiana Arauz. Octubre 2026'
const MEMBER = '3d226ece-06fa-41f5-8d7e-4dfcb9abf96f'
const AUTH = '919ed96a-9d58-4120-afce-5d2986f1cf55'
const VIEJO = 'santiagoconejor@hotmail.com', NUEVO = 'santiagoconejor@gmail.com'
const BACKUP = 'docs/correcciones/2026-10-28-grupo-tatiana-y-correo-santiago.json'
const SCRIPT = 'scripts/finanzas-2026-10-28/grupo-tatiana-y-correo-santiago.cjs'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows: [g] } = await c.query(`select id, name, leader_id from study_groups where id=$1`, [GRUPO])
  const { rows: [m] } = await c.query(`select id, first_name||' '||last_name nombre, email, auth_user_id from members where id=$1`, [MEMBER])
  if (!g || g.leader_id !== 'f069b781-5b0f-4cf9-bd19-f2cd8662d729') throw new Error('el grupo no está como se midió')
  if (!m || m.email !== VIEJO || m.auth_user_id !== AUTH) throw new Error('la ficha no está como se midió')
  const { rows: ocupado } = await c.query(`select id from members where lower(email)=$1 union all select id from auth.users where lower(email)=$1`, [NUEVO])
  if (ocupado.length) throw new Error(`el correo nuevo ya está en uso: ${JSON.stringify(ocupado)}`)
  console.log(`grupo: «${g.name}» → «${NOMBRE_NUEVO}»`)
  console.log(`${m.nombre}: ${m.email} → ${NUEVO} (ficha + login ${AUTH})`)
  if (!APLICAR) { console.log('(medición; --aplicar para escribir)'); await c.end(); return }

  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), motivo: 'Floriana, 28/10/2026', grupo_antes: g, member_antes: m }, null, 2))
  await c.query('begin')
  try {
    await c.query(`update study_groups set name=$2, updated_at=now() where id=$1`, [GRUPO, NOMBRE_NUEVO])
    await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE','study_groups',$1,$2,$3)`, [GRUPO, { name: g.name }, { op: 'grupo_renombrado', name: NOMBRE_NUEVO, script: SCRIPT }])
    await c.query(`update members set email=$2, updated_at=now() where id=$1`, [MEMBER, NUEVO])
    await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE','members',$1,$2,$3)`, [MEMBER, { email: VIEJO }, { op: 'correo_cambiado', email: NUEVO, motivo: 'perdió el acceso al correo viejo', script: SCRIPT }])
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.admin.updateUserById(AUTH, { email: NUEVO, email_confirm: true })
  if (error) { console.error('FICHA cambiada pero el LOGIN no:', error.message); process.exit(1) }
  console.log('login:', data.user.email)
  console.log('Después:', (await c.query(`select (select name from study_groups where id=$1) grupo, (select email from members where id=$2) ficha, (select email from auth.users where id=$3) login`, [GRUPO, MEMBER, AUTH])).rows[0])
  console.log(`Respaldo en ${BACKUP}`)
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })

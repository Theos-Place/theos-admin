/**
 * El correo juanedvargas@gmail.com estaba en la ficha de Gilda Gonzalez (la
 * mamá) y es de Juan Eduardo Vargas Gonzalez. Floriana (2026-10-30): dejárselo
 * a él y quitárselo a ella. Ninguna de las dos fichas tiene cuenta de acceso.
 *   node scripts/correcciones-2026-10-30/correo-juan-eduardo.cjs [--aplicar]
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const JUAN = '5d8582e6-9194-456a-b31c-59630aed54fd'
const GILDA = 'f9c37d9c-caa1-4772-9f3d-bb9ddf8bb5d1'
const CORREO = 'juanedvargas@gmail.com'
const BACKUP = 'docs/correcciones/2026-10-30-correo-juan-eduardo-vargas.json'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query('select id, first_name, last_name, email, auth_user_id from members where id = any($1::uuid[])', [[JUAN, GILDA]])
  const j = rows.find(r => r.id === JUAN), g = rows.find(r => r.id === GILDA)
  if (!j || !g) throw new Error('falta una ficha')
  if (g.email?.toLowerCase() !== CORREO) throw new Error(`Gilda ya no tiene ese correo: ${g.email}`)
  if (j.email) throw new Error(`Juan Eduardo ya tiene correo: ${j.email}`)
  if (j.auth_user_id || g.auth_user_id) throw new Error('alguna ficha tiene cuenta de acceso: parar y mirar')
  console.log(`Gilda: ${g.email} → (vacío) · Juan Eduardo: (vacío) → ${CORREO}`)
  if (!APLICAR) { console.log('(medición; --aplicar para escribir)'); await c.end(); return }
  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), motivo: 'Correo de Juan Eduardo estaba en la ficha de su mamá (Floriana, 2026-10-30)', antes: { gilda: g, juan: j } }, null, 2))
  await c.query('begin')
  try {
    await c.query('update members set email=null, updated_at=now() where id=$1', [GILDA])
    await c.query('update members set email=$2, updated_at=now() where id=$1', [JUAN, CORREO])
    await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE','members',$1,$2,$3), ('UPDATE','members',$4,$5,$6)`,
      [GILDA, { email: CORREO }, { email: null, op: 'correo_movido_al_hijo', a: JUAN }, JUAN, { email: null }, { email: CORREO, op: 'correo_movido_desde_la_mama', de: GILDA }])
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  console.log('Después:', (await c.query('select first_name, email from members where id = any($1::uuid[])', [[JUAN, GILDA]])).rows, '→', BACKUP)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

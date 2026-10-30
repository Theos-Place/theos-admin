/**
 * Charla Liberia Miércoles (2026-10-28), pedido de Floriana (2026-10-30):
 *  · Mariela Soto Vindas sirve en Bienvenida de Sede Liberia y quedó como
 *    asistente (el modal de familia no le ofreció «Servidor»): pasa a servidora.
 *  · Tres fichas nuevas de esa noche sin fecha de nacimiento (el calendario no
 *    se veía): se les pone la que mandó Bienvenida.
 *   node scripts/correcciones-2026-10-30/liberia-28-oct.cjs [--aplicar]
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const EVENTO = 'e4d1f741-158c-4b34-b400-0ac74be2324c'
const MARIELA = '397229b9-a03d-4f1b-afe0-6492a9d85b66'
const FECHAS = {
  'ba44f988-7b1c-47a7-94aa-5d01681dd510': ['Stefanía Rodríguez Alemán', '2008-07-10'],
  '0b9404e3-7b9b-4b59-8c65-07f0cc9ce9fb': ['Carlos María Ugarte Ortega', '1988-12-27'],
  'a96560d1-2319-4c7a-8ca5-df7bc27a5d5e': ['Ana Sofía Apú Castrillo', '2009-10-24'],
}
const BACKUP = 'docs/correcciones/2026-10-30-liberia-28-oct.json'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows: [ci] } = await c.query(`select * from event_checkins where event_id=$1 and member_id=$2 and (checked_in_at at time zone 'America/Costa_Rica')::date='2026-10-28'`, [EVENTO, MARIELA])
  if (!ci) throw new Error('Mariela no tiene check-in del 28-oct en Liberia')
  const { rows: fichas } = await c.query(`select id, first_name||' '||last_name n, birth_date from members where id = any($1::uuid[])`, [Object.keys(FECHAS)])
  if (fichas.length !== 3) throw new Error(`esperaba 3 fichas, hay ${fichas.length}`)
  for (const f of fichas) { if (f.n !== FECHAS[f.id][0]) throw new Error(`${f.id} es «${f.n}», no «${FECHAS[f.id][0]}»`); if (f.birth_date) throw new Error(`${f.n} ya tiene fecha`) }
  console.log(`Mariela: check-in ${ci.id} ${ci.checked_in_as} → servidor`)
  for (const f of fichas) console.log(`${f.n}: (sin fecha) → ${FECHAS[f.id][1]}`)
  if (!APLICAR) { console.log('(medición; --aplicar para escribir)'); await c.end(); return }
  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), checkin_antes: ci, fichas_antes: fichas }, null, 2))
  await c.query('begin')
  try {
    await c.query(`update event_checkins set checked_in_as='servidor' where id=$1`, [ci.id])
    await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE','event_checkins',$1,$2,$3)`, [ci.id, { checked_in_as: ci.checked_in_as }, { checked_in_as: 'servidor', op: 'servidora_de_bienvenida_liberia', motivo: 'El modal de familia no ofreció Servidor (Floriana, 2026-10-30)' }])
    for (const f of fichas) {
      await c.query(`update members set birth_date=$2, updated_at=now() where id=$1`, [f.id, FECHAS[f.id][1]])
      await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE','members',$1,$2,$3)`, [f.id, { birth_date: null }, { birth_date: FECHAS[f.id][1], op: 'fecha_que_no_se_pudo_poner_en_la_puerta' }])
    }
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  console.log('✅ aplicado →', BACKUP)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

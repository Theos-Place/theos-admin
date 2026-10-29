/**
 * COM-5 · Marca la imagen del cuerpo del «Boletín mensual» como ranura
 * (data-imagen-slot="principal") para que se pueda cambiar desde la pantalla
 * sin tocar HTML. Solo agrega el atributo a ESA etiqueta; el resto queda igual.
 *   node scripts/com5-2026-10-29/marcar-ranura-boletin.cjs [--aplicar]
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const ID = '57e2fd20-f59f-4d3a-bcfc-73dc93da99dc'
const BACKUP = 'docs/correcciones/2026-10-29-boletin-ranura-de-imagen.json'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows: [t] } = await c.query('select id, name, body from message_templates where id=$1', [ID])
  if (!t) throw new Error('no existe la plantilla')
  if (t.body.includes('data-imagen-slot=')) { console.log('ya tiene ranura; nada que hacer'); await c.end(); return }
  const imgs = t.body.match(/<img\b[^>]*>/gi) ?? []
  if (imgs.length !== 1) throw new Error(`esperaba 1 <img>, hay ${imgs.length}`)
  const nuevo = t.body.replace(imgs[0], imgs[0].replace(/^<img\b/i, '<img data-imagen-slot="principal"'))
  if (nuevo === t.body) throw new Error('no cambió nada')
  console.log(`${t.name}: ${t.body.length} → ${nuevo.length} caracteres (+${nuevo.length - t.body.length})`)
  if (!APLICAR) { console.log('(medición; --aplicar para escribir)'); await c.end(); return }
  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), id: ID, body_antes: t.body }, null, 2))
  await c.query('begin')
  try {
    await c.query('update message_templates set body=$2, updated_at=now() where id=$1', [ID, nuevo])
    await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE','message_templates',$1,$2,$3)`,
      [ID, { body: t.body }, { op: 'com5_ranura_de_imagen', atributo: 'data-imagen-slot="principal"' }])
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  console.log('✅ aplicado →', BACKUP)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

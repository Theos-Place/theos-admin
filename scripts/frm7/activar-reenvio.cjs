// FRM-7 · Activa «responder más de una vez» (ventana 2 días) en los 10
// formularios de actividades sociales. Correr DESPUÉS del deploy (la columna
// reanswer_after_days nace con la migración 20261026120000).
//   node scripts/frm7/activar-reenvio.cjs          → dry run
//   node scripts/frm7/activar-reenvio.cjs --aplicar
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const IDS = [
  '3d60d1ff-a21b-4c6a-9911-860263db7a6f', '7647e12d-691b-491f-883c-12803465bbbe', '1b58cd13-c9fe-49c3-be9e-7231ca6fbd86',
  'af0a33f8-359f-4407-9eb2-17f91d52d682', '4c74325e-45d9-4b8e-9144-678ddf917947', 'a536c932-f140-4bf4-8a7f-38b4950aee7a',
  'f4ba8c49-b7d3-422d-80a5-3d955487b97a', '30b0c4c9-8bd4-490e-bcb4-7abc46acb4c4', '99aba2b1-ccf1-43c5-8473-0f08166f5166',
  '5362437c-45a0-47ba-b15c-cae0bc804d4c',
]
const APLICAR = process.argv.includes('--aplicar')
;(async () => {
  const c = nuevoCliente(); await c.connect(); await c.query('set statement_timeout = 60000')
  const antes = (await c.query('select id, title, allow_multiple_responses, reanswer_after_days from forms where id = any($1) order by title', [IDS])).rows
  console.table(antes)
  if (!APLICAR) { console.log('DRY RUN — nada escrito. Corré con --aplicar.'); await c.end(); return }
  require('fs').writeFileSync(`docs/correcciones/${new Date().toISOString().slice(0, 10)}-frm7-reenvio-activado.json`, JSON.stringify({ motivo: 'FRM-7: activar responder más de una vez (2 días) en los formularios de actividades sociales', antes }, null, 2))
  await c.query('begin')
  const r = await c.query('update forms set allow_multiple_responses = true, reanswer_after_days = 2 where id = any($1)', [IDS])
  if (r.rowCount !== IDS.length) { await c.query('rollback'); throw new Error(`esperaba ${IDS.length}, actualizó ${r.rowCount}`) }
  await c.query('commit')
  console.log(`✅ ${r.rowCount} formularios con reenvío activado (ventana 2 días)`)
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })

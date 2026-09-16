/** Prueba que la base REALMENTE impide cancelar sin motivo. Todo en rollback. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  const { rows } = await c.query(`select id from scholarships where status='active' limit 1`)
  const id = rows[0].id
  const probar = async (nombre, sql, params) => {
    await c.query('savepoint sp')
    try { await c.query(sql, params); console.log(`  ${nombre}: PASÓ`); await c.query('rollback to sp') }
    catch (e) { console.log(`  ${nombre}: BLOQUEADO (${e.constraint || e.message.slice(0,60)})`); await c.query('rollback to sp') }
  }
  console.log('Intentos de cancelar la beca ' + id + ':')
  await probar('sin motivo             ', `update scholarships set status='revoked' where id=$1`, [id])
  await probar('motivo vacío           ', `update scholarships set status='revoked', revoke_reason='' where id=$1`, [id])
  await probar('motivo de puros espacios', `update scholarships set status='revoked', revoke_reason='          ' where id=$1`, [id])
  await probar('motivo corto ("error") ', `update scholarships set status='revoked', revoke_reason='error' where id=$1`, [id])
  await probar('motivo de verdad       ', `update scholarships set status='revoked', revoke_reason='Se emitió por error' where id=$1`, [id])
  await c.query('rollback'); await c.end()
  console.log('\n(todo revertido)')
})().catch(e => { console.error(e.message); process.exit(1) })

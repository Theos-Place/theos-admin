/**
 * Corrección del usuario (2026-09-11): Hombres y Mujeres van a COMUNIDAD, no a
 * Journey. El madre los ponía en Journey y la Etapa 1 los había movido ahí.
 * Journey queda vacía — se creó en esta misma corrida solo para ellos.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')
;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const { rows:[destino] } = await c.query(`select id, name from areas where area_type='area' and name='Area de Comunidad'`)
  const { rows: mover } = await c.query(
    `select c.id, c.name, p.name area from areas c left join areas p on p.id=c.parent_id
     where c.name in ('Comité de Hombres','Comité de Mujeres')`)
  if (mover.length !== 2) { console.error('ABORTA — esperaba 2 comités, hay', mover.length); process.exit(1) }
  mover.forEach(m => console.log(`  ${m.name.padEnd(22)} ${m.area} → ${destino.name}`))
  await c.query('begin')
  await c.query(`update areas set parent_id=$1, updated_at=now() where id = any($2)`, [destino.id, mover.map(m=>m.id)])
  const { rows: q } = await c.query(
    `select p.name area, count(*)::int n from areas c join areas p on p.id=c.parent_id
     where c.area_type='committee' group by 1 order by 1`)
  console.log('\ncomités por área:'); q.forEach(r=>console.log(`  ${r.area.padEnd(20)} ${r.n}`))
  const { rows: j } = await c.query(`select count(*)::int n from areas where parent_id=(select id from areas where name='Journey')`)
  console.log(`\nJourney queda con ${j[0].n} comités`)
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 SIMULACIÓN (rollback).') }
  await c.end()
})().catch(async e => { console.error(e); process.exit(1) })

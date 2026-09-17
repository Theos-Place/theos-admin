const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select updated_at, data from report_snapshots where report_key='discipulos_payload'`)
  const d = r.rows[0].data
  console.log('foto tomada: ' + r.rows[0].updated_at.toISOString())
  console.log('  donan:         ' + JSON.stringify(d.criteria.donan))
  console.log('  comprometidos: ' + JSON.stringify(d.criteria.comprometidos))
  console.log('  sirven:        ' + JSON.stringify(d.criteria.sirven))
  console.log('  DM:            ' + d.dm)
  const v = d.venn
  const sumaDona = v.soloDona + v.comprometidoDona + v.sirveDona + v.losTres
  console.log(`  Venn, regiones de Dona suman: ${sumaDona}`)
  const flag = await c.query(`select count(*) n from members where is_donor`)
  console.log(`  members.is_donor (dashboard): ${flag.rows[0].n}`)
  console.log(sumaDona === Number(flag.rows[0].n) && d.criteria.donan.n === Number(flag.rows[0].n)
    ? '\n>>> los tres números coinciden' : '\n>>> SIGUEN SIN COINCIDIR')
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

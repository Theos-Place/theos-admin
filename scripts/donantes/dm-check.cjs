/** SOLO LECTURA: ¿el reporte DM cuenta los mismos donantes que la bandera? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const flag = await c.query(`select count(*) n from members where is_donor`)
  // Los mismos parámetros que usa la pantalla (12 meses, 90 días, 4 charlas).
  const dm = await c.query(`
    select count(*) filter (where dona) as donan,
           count(*) filter (where es_comprometido) as comprometidos,
           count(*) filter (where sirve) as sirven,
           count(*) filter (where es_dm) as dm,
           count(*) as base
    from get_dm_flags((now() - interval '12 months')::timestamptz, (now() - interval '90 days')::timestamptz, 4)`)
  console.log(`members.is_donor:           ${flag.rows[0].n}`)
  console.log(`get_dm_flags -> dona:       ${dm.rows[0].donan}`)
  console.log(`  comprometidos: ${dm.rows[0].comprometidos} · sirven: ${dm.rows[0].sirven} · DM: ${dm.rows[0].dm} · base: ${dm.rows[0].base}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

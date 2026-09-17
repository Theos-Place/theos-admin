/** SOLO LECTURA: ¿el reporte DM está sirviendo una foto vieja? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const s = await c.query(`select report_key, updated_at, pg_column_size(data) bytes from report_snapshots order by updated_at desc`)
  console.log('=== snapshots guardados ===')
  s.rows.forEach(x => console.log(`  ${String(x.report_key).padEnd(28)} ${x.updated_at.toISOString()}  ${x.bytes} bytes`))

  // Los parámetros REALES de la pantalla: 6 meses, 60 días, 6 charlas.
  const live = await c.query(`
    select count(*) filter (where dona) donan,
           count(*) filter (where es_comprometido) comprometidos,
           count(*) filter (where sirve) sirven,
           count(*) filter (where es_dm) dm,
           count(*) filter (where es_comprometido and not sirve and not dona) solo_comp,
           count(*) filter (where dona and not sirve and not es_comprometido) solo_dona
    from get_dm_flags((now() - interval '6 months')::timestamptz, (now() - interval '60 days')::timestamptz, 6)`)
  console.log('\n=== EN VIVO, con los parámetros de la pantalla (6 meses, 60 días, 6 charlas) ===')
  console.log('  ' + JSON.stringify(live.rows[0]))
  const flag = await c.query(`select count(*) n from members where is_donor`)
  console.log(`  members.is_donor: ${flag.rows[0].n}`)

  // ¿Qué dice la foto guardada del DM?
  const d = await c.query(`select report_key, data from report_snapshots where report_key ilike '%dm%' or report_key ilike '%discip%'`)
  d.rows.forEach(x => {
    const j = x.data
    console.log(`\n=== foto '${x.report_key}' ===`)
    console.log('  ' + JSON.stringify(j).slice(0, 400))
  })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

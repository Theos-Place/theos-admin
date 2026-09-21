const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921210000_rep6_personas_nuevas.sql'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const p = await c.query(`select proname, proacl::text acl from pg_proc
      where proname in ('primera_actividad_por_miembro','report_personas_nuevas_series','report_personas_nuevas')`)
    for (const f of p.rows) {
      const acl = f.acl || ''
      const abierto = /[{,]=X\//.test(acl) || /\banon=/.test(acl) || /\bauthenticated=/.test(acl)
      console.log(`  ${f.proname.padEnd(32)} abierta=${abierto}`)
      if (abierto) throw new Error(`${f.proname} quedó abierta`)
    }
    let t = Date.now()
    const s = await c.query('select * from report_personas_nuevas_series()')
    console.log(`serie: ${s.rowCount} filas · ${Date.now() - t}ms`)
    t = Date.now()
    const d = await c.query(`select * from report_personas_nuevas('2026-08-01','2026-08-31')`)
    console.log(`detalle agosto 2026: ${d.rowCount} personas · ${Date.now() - t}ms`)
    console.table(d.rows.slice(0, 6))
    const porCanal = d.rows.reduce((a, x) => { a[x.canal] = (a[x.canal] || 0) + 1; return a }, {})
    console.log('canal:', porCanal)
    console.log('volvieron:', d.rows.filter(x => x.volvio).length, '· se matricularon:', d.rows.filter(x => x.se_matriculo).length,
      '· servidores:', d.rows.filter(x => x.es_servidor).length, '· sin birth_date:', d.rows.filter(x => !x.birth_date).length)

    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921210000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

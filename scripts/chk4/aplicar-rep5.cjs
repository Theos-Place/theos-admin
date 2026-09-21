const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921200000_rep5_asistentes_de_la_semana.sql'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const p = await c.query(`select proacl::text acl, prosecdef, proconfig
      from pg_proc where proname='report_asistentes_de_la_semana'`)
    const acl = p.rows[0].acl || ''
    const abierto = /[{,]=X\//.test(acl) || /\banon=/.test(acl) || /\bauthenticated=/.test(acl)
    console.log('permisos:', p.rows[0], '· abierta:', abierto)
    if (abierto) throw new Error('quedó abierta — rollback')

    // Prueba con una semana real: 2026-W37 (7–13 de setiembre).
    const r = await c.query(`select * from report_asistentes_de_la_semana('2026-09-07','2026-09-13')`)
    console.log(`asistentes de la semana 2026-W37: ${r.rowCount}`)
    console.table(r.rows.slice(0, 5))
    const sinVolver = r.rows.filter(x => !x.regreso).length
    console.log(`sin ningún check-in posterior: ${sinVolver}`)

    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921200000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

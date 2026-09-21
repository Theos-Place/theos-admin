const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921270000_rep9_bloque_en_el_reporte.sql'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const p = await c.query(`select proacl::text acl from pg_proc where proname='report_estudios_del_anio'`)
    const acl = p.rows[0].acl || ''
    if (/[{,]=X\//.test(acl) || /\banon=/.test(acl)) throw new Error('quedó abierta')
    const r = await c.query('select * from report_estudios_del_anio(2026)')
    const porBloque = r.rows.reduce((a, x) => { const k = x.bloque ?? '(sin bloque)'; a[k] = (a[k] || 0) + 1; return a }, {})
    console.log(`2026: ${r.rowCount} filas`)
    console.table(Object.entries(porBloque).map(([bloque, filas]) => ({ bloque, filas })))
    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921270000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

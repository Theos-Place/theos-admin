const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921250000_rep10_serie_con_origen.sql'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const p = await c.query(`select proacl::text acl from pg_proc where proname='report_personas_nuevas_series'`)
    const acl = p.rows[0].acl || ''
    if (/[{,]=X\//.test(acl) || /\banon=/.test(acl)) throw new Error('quedó abierta')
    const t = Date.now()
    const r = await c.query('select * from report_personas_nuevas_series()')
    console.log(`filas de la serie: ${r.rowCount} · ${Date.now() - t}ms`)
    const total = r.rows.reduce((n, x) => n + Number(x.n), 0)
    console.log(`personas en total: ${total}`)
    const origenes = new Set(r.rows.map(x => x.origen).filter(Boolean))
    console.log(`orígenes distintos: ${origenes.size}`)
    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921250000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921240000_rep8_demografia_por_sede.sql'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const p = await c.query(`select proacl::text acl from pg_proc where proname='report_demografia_por_sede'`)
    const acl = p.rows[0].acl || ''
    if (/[{,]=X\//.test(acl) || /\banon=/.test(acl)) throw new Error('quedó abierta')
    const t = Date.now()
    const r = await c.query(`select * from report_demografia_por_sede('2026-01-01','2026-12-31')`)
    console.log(`filas (persona × sede) en 2026: ${r.rowCount} · ${Date.now() - t}ms`)
    const personas = new Set(r.rows.map(x => x.member_id))
    console.log(`personas distintas: ${personas.size} · sin fecha de nacimiento: ${r.rows.filter(x => !x.birth_date).length} · sin género: ${r.rows.filter(x => !x.gender).length}`)
    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921240000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

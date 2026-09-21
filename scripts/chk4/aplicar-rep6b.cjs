const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921220000_rep6_volvio_en_5_semanas.sql'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const antes = await c.query(`select count(*) filter (where volvio)::int v, count(*)::int n
      from report_personas_nuevas('2026-08-01','2026-08-31')`)
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const p = await c.query(`select proacl::text acl from pg_proc where proname='report_personas_nuevas'`)
    const acl = p.rows[0].acl || ''
    if (/[{,]=X\//.test(acl) || /\banon=/.test(acl)) throw new Error('quedó abierta')
    const despues = await c.query(`select count(*) filter (where volvio)::int v, count(*)::int n
      from report_personas_nuevas('2026-08-01','2026-08-31')`)
    console.log(`agosto 2026 · antes (8 sem): ${antes.rows[0].v} de ${antes.rows[0].n}`)
    console.log(`agosto 2026 · ahora (5 sem): ${despues.rows[0].v} de ${despues.rows[0].n}`)
    if (despues.rows[0].v > antes.rows[0].v) throw new Error('una ventana más corta no puede dar MÁS gente')
    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921220000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

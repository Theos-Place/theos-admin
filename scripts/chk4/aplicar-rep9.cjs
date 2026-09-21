const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921260000_rep9_reporte_de_estudios.sql'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    for (const f of ['report_estudios_del_anio', 'report_estudios_series']) {
      const p = await c.query('select proacl::text acl from pg_proc where proname=$1', [f])
      const acl = p.rows[0].acl || ''
      if (/[{,]=X\//.test(acl) || /\banon=/.test(acl)) throw new Error(`${f} quedó abierta`)
    }
    let t = Date.now()
    const r = await c.query('select * from report_estudios_del_anio(2026)')
    console.log(`2026: ${r.rowCount} filas (plan × persona) · ${Date.now() - t}ms`)
    console.log(`  personas distintas: ${new Set(r.rows.map(x => x.member_id)).size}`)
    console.log(`  grupos distintos: ${new Set(r.rows.map(x => x.grupo_id)).size}`)
    console.log(`  planes: ${new Set(r.rows.map(x => x.plan_code)).size}`)
    console.log(`  sin fecha de nacimiento: ${r.rows.filter(x => !x.birth_date).length}`)
    t = Date.now()
    const s = await c.query('select * from report_estudios_series()')
    console.log(`serie: ${s.rowCount} filas · ${Date.now() - t}ms`)
    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921260000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

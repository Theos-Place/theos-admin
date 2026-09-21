const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921230000_rep8_asistentes_con_visitas.sql'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const p = await c.query(`select proacl::text acl from pg_proc where proname='report_asistentes_de_la_semana'`)
    const acl = p.rows[0].acl || ''
    if (/[{,]=X\//.test(acl) || /\banon=/.test(acl)) throw new Error('quedó abierta')
    const t = Date.now()
    const r = await c.query(`select * from report_asistentes_de_la_semana('2026-09-07','2026-09-13')`)
    const dos = r.rows.filter(x => Number(x.visitas) >= 2).length
    console.log(`semana 2026-W37: ${r.rowCount} con check-in · ${dos} con 2+ visitas · ${r.rowCount - dos} de una sola vez · ${Date.now() - t}ms`)
    console.table(r.rows.slice(0, 4).map(x => ({ nombre: x.nombre.slice(0, 26), visitas: x.visitas, regreso: x.regreso ? String(x.regreso).slice(0, 10) : null })))
    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921230000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

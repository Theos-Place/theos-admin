const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const archivo = process.argv[2]
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(archivo, 'utf8'))
    const p = await c.query(`
      select proacl::text acl, p.prosecdef, p.proconfig
      from pg_proc p where proname='ultimo_checkin_de_miembros'`)
    console.log('permisos:', p.rows[0])
    // PUBLIC en un ACL es el grantee VACÍO: "{=X/postgres,...}". Buscar "=X/"
    // a secas matchea también "service_role=X/postgres", que es lo que sí queremos.
    const acl = p.rows[0].acl || ''
    const abierto = /[{,]=X\//.test(acl) || /\banon=/.test(acl) || /\bauthenticated=/.test(acl)
    console.log('¿queda abierta a anon/public?', abierto)
    if (abierto) throw new Error('la función quedó abierta — rollback')
    const version = archivo.match(/(\d{14})/)[1]
    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ($1,$2) on conflict do nothing`, [version, archivo.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

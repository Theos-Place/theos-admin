const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const ARCHIVO = process.argv[2]
const VERSION = ARCHIVO.match(/(\d{14})_/)[1]
const aplicar = process.argv.includes('--aplicar')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const r = await c.query(`select id, status, revoked_at, revoked_by, revoke_reason, notes from scholarships where status='revoked'`)
    console.log(`becas canceladas tras la migración: ${r.rowCount}`)
    r.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
    if (aplicar) {
      await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1,$2) on conflict do nothing`,
        [VERSION, ARCHIVO.split('/').pop().replace(/^\d+_/,'').replace(/\.sql$/,'')])
      await c.query('commit'); console.log('\n>>> APLICADA y registrada')
    } else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()

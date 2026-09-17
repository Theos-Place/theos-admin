const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const ARCHIVO = 'supabase/migrations/20260917120000_charla_subevento_con_su_sede.sql'
const aplicar = process.argv.includes('--aplicar')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const r = await c.query(`
      select title, sum(checkins)::int n from report_charla_attendance()
      where iso_yr=2026 and wk in (37,38) and title ilike '%youth%' group by 1 order by 1`)
    console.log('=== semanas 37 y 38, títulos con youth (según el RPC nuevo) ===')
    r.rows.forEach(x => console.log(`  ${String(x.title).padEnd(40)} ${x.n}`))
    if (r.rows.some(x => x.title.trim() === 'Youth')) throw new Error('GUARDA: sigue saliendo "Youth" a secas')
    if (aplicar) {
      await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ('20260917120000','charla_subevento_con_su_sede') on conflict do nothing`)
      await c.query('commit'); console.log('\n>>> APLICADA')
    } else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()

const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  try {
    const j = await c.query(`select jobid, schedule, command, active, jobname from cron.job order by jobname`)
    console.log('=== pg_cron ==='); j.rows.forEach(x => console.log(`  ${String(x.jobname).padEnd(28)} ${String(x.schedule).padEnd(14)} activo=${x.active}  ${x.command}`))
    const r = await c.query(`select jobid, status, return_message, start_time from cron.job_run_details
      where jobid = (select jobid from cron.job where jobname='refresh-donor-flags')
      order by start_time desc limit 3`)
    console.log('\n=== últimas corridas de refresh-donor-flags ==='); r.rows.forEach(x => console.log(`  ${x.start_time?.toISOString()} ${x.status} ${x.return_message ?? ''}`))
  } catch (e) { console.log('cron: ' + e.message) }

  const f = await c.query(`select pg_get_functiondef(oid) as def from pg_proc where proname='get_dm_flags'`)
  const def = f.rows[0].def
  const m = def.match(/donadores as \([\s\S]*?\)[,\n]/)
  console.log('\n=== la CTE donadores del reporte DM ===\n' + (m ? m[0] : 'no encontrada'))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

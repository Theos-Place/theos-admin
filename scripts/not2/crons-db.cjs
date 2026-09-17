/** SOLO LECTURA: los crons que corren DENTRO de la base (pg_cron), aparte de Vercel. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const j = await c.query(`select jobname, schedule, command, active from cron.job order by jobname`)
  console.log(`=== pg_cron (dentro de Supabase, NO cuentan para Vercel): ${j.rowCount} ===`)
  j.rows.forEach(x => console.log(`  ${String(x.jobname).padEnd(24)} ${String(x.schedule).padEnd(14)} activo=${x.active}  ${x.command}`))
  const r = await c.query(`
    select j.jobname, count(*) n,
           count(*) filter (where d.status <> 'succeeded') fallos,
           round(avg(extract(epoch from (d.end_time - d.start_time)))::numeric, 2) seg_prom,
           max(d.start_time) ultima
    from cron.job_run_details d join cron.job j on j.jobid=d.jobid
    where d.start_time > now() - interval '7 days' group by 1 order by 1`)
  console.log(`\n=== últimos 7 días ===`)
  r.rows.forEach(x => console.log(`  ${String(x.jobname).padEnd(24)} ${String(x.n).padStart(3)} corridas · ${x.fallos} fallos · ${x.seg_prom}s prom · última ${x.ultima.toISOString().slice(0,16)}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

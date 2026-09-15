/** Regenera los snapshots de reportes tras la unificación de series de charlas. */
;(async () => {
  const { refreshReportSnapshots } = await import('../../src/lib/supabase/queries/reports.ts')
  console.log(await refreshReportSnapshots())
})().catch(e => { console.error(e); process.exit(1) })

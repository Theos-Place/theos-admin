/** Evidencia: la serie unificada muestra línea continua año a año. */
const MIRAR = ['Pedregal Miércoles', 'Meridiano Martes', 'Pedregal Jueves', 'Meridiano Miércoles', 'Madrid Home Jueves']
;(async () => {
  const { getCharlaAttendanceReport } = await import('../../src/lib/supabase/queries/reports.ts')
  for (const sede of MIRAR) {
    const r = await getCharlaAttendanceReport({ sede })
    const porAnio = (r.annualCards ?? []).map(c => `${c.year}: ${c.total ?? c.checkins ?? JSON.stringify(c)}`)
    console.log(`\n── ${sede}`)
    console.log('   ' + porAnio.join('   '))
  }
})().catch(e => { console.error(e); process.exit(1) })

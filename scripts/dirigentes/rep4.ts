/** SOLO LECTURA: qué va a mostrar el reporte con las semanas en fechas. */
import { rangoDeSemana } from '@/lib/reports/rango-de-semana'
import { getCharlaAttendanceReport } from '@/lib/supabase/queries/reports'

async function main() {
  const r = await getCharlaAttendanceReport(2026, 'all')
  console.log(`año ${r.year} · ${r.weekly.length} semanas con datos\n`)
  console.log('ANTES → AHORA (eje)            |  tooltip')
  for (const w of r.weekly.slice(0, 4)) {
    const g = rangoDeSemana(r.year, w.week, r.year)
    console.log(`  ${String(w.week).padStart(2)} → ${g.etiquetaCorta.padEnd(8)} | ${g.conNumero}`)
  }
  console.log('  ...')
  for (const w of r.weekly.slice(-3)) {
    const g = rangoDeSemana(r.year, w.week, r.year)
    console.log(`  ${String(w.week).padStart(2)} → ${g.etiquetaCorta.padEnd(8)} | ${g.conNumero}`)
  }
  const s26 = r.weekly.find(w => w.week === 26)
  console.log(`\nel caso del pedido · semana 26: ${rangoDeSemana(2026, 26, 2026).etiqueta} · ${s26?.total ?? '—'} check-ins`)
  const cruzan = r.weekly.filter(w => {
    const g = rangoDeSemana(r.year, w.week, r.year)
    return g.desde.getUTCMonth() !== g.hasta.getUTCMonth()
  })
  console.log(`semanas que cruzan de mes: ${cruzan.length} → ${cruzan.slice(0,3).map(w => rangoDeSemana(r.year, w.week, r.year).etiqueta).join(' · ')}`)
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })

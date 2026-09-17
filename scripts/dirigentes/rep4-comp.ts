/** SOLO LECTURA: la comparación que motivó el pedido, con datos reales. */
import { getCharlaAttendanceReport } from '@/lib/supabase/queries/reports'
import { unirSeries } from '@/lib/reports/comparar-series'
import { rangoDeSemana } from '@/lib/reports/rango-de-semana'

async function main() {
  const [martes, miercoles] = await Promise.all([
    getCharlaAttendanceReport({ year: 2026, sede: 'Meridiano Martes' }),
    getCharlaAttendanceReport({ year: 2026, sede: 'Meridiano Miércoles' }),
  ])
  const filas = unirSeries(martes.weekly, miercoles.weekly)
  console.log('semana            Meridiano Martes   Meridiano Miércoles')
  for (const f of filas) {
    const g = rangoDeSemana(2026, f.week, 2026)
    console.log(`  ${g.etiqueta.padEnd(16)} ${String(f.total).padStart(6)}            ${f.comparado === null ? '   —' : String(f.comparado).padStart(4)}`)
  }
  const arranque = filas.find(f => f.comparado !== null)
  console.log(`\nMeridiano Miércoles arranca en: ${arranque ? rangoDeSemana(2026, arranque.week, 2026).etiqueta : '—'}`)
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })

/** SOLO LECTURA: cómo quedan las semanas que reportó el usuario. */
import { getSemanaDetalle } from '@/lib/supabase/queries/reports'
import { getCharlaAttendanceReport } from '@/lib/supabase/queries/reports'
import { rangoDeSemana } from '@/lib/reports/rango-de-semana'

async function main() {
  for (const wk of [35, 37, 38]) {
    const d = await getSemanaDetalle(2026, wk)
    console.log(`\n=== ${rangoDeSemana(2026, wk, 2026).etiqueta} (semana ${wk}) ===`)
    for (const s of d.porSede) console.log(`  ${s.sede.padEnd(32)} ${s.total}`)
  }
  const r = await getCharlaAttendanceReport({ year: 2026 })
  const youth = r.sedes.filter(s => /youth/i.test(s))
  console.log('\nsedes con "youth" en el filtro del año: ' + youth.join(' · '))
  console.log('¿aparece "Youth" a secas?: ' + (r.sedes.includes('Youth') ? 'SÍ — mal' : 'no'))
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })

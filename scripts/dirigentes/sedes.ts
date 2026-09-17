import { getCharlaAttendanceReport } from '@/lib/supabase/queries/reports'
getCharlaAttendanceReport({ year: 2026 }).then(r => {
  console.log(`sedes disponibles en el filtro (${r.sedes.length}):`)
  r.sedes.forEach(s => console.log('  ' + s))
  console.log('\nranking del año:')
  r.sedeRanking.slice(0, 12).forEach(s => console.log(`  ${s.sede.padEnd(28)} ${s.total}`))
}).catch(e => { console.error(e.message); process.exit(1) })

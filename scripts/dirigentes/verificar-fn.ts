/** SOLO LECTURA: corre getActiveDirigentes() ya arreglada. */
import { getActiveDirigentes } from '@/lib/supabase/queries/studies'
getActiveDirigentes()
  .then(d => {
    console.log(`getActiveDirigentes() devuelve: ${d.length} dirigentes activos`)
    console.log('  primeros 3: ' + d.slice(0, 3).map(x => x.member_name).join(' · '))
  })
  .catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })

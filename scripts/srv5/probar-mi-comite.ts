/** SOLO LECTURA: la query de "Mi comité" contra producción. */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { getMiComite } from '../../src/lib/supabase/queries/mi-comite'
import { leFaltaAlgo, faltantes } from '../../src/lib/servers/compromisos'

;(async () => {
  for (const id of process.argv.slice(2)) {
    const t0 = Date.now()
    const { nombre, filas } = await getMiComite(id)
    console.log(`\n=== ${nombre} · ${filas.length} personas · ${Date.now() - t0}ms ===`)
    for (const f of filas.slice(0, 12)) {
      console.log(
        `  ${f.encargado ? '★' : ' '} ${f.nombre.padEnd(34)}`,
        `asis:${f.asistencia ? '✓' : '✗'}`,
        `est:${f.llevandoEstudio ? 'L' : '-'}${f.dandoEstudio ? 'D' : '-'}`,
        `don:${f.donante ? '✓' : '✗'}`,
        `últ:${f.ultimoCheckin ?? '—'}`,
        faltantes(f).length ? `· falta ${faltantes(f).join(', ')}` : '',
      )
    }
    console.log(`  … con algo pendiente: ${filas.filter(leFaltaAlgo).length} de ${filas.length}`)
  }
})().catch((e: Error) => { console.error(e); process.exit(1) })

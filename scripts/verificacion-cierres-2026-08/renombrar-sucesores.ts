/**
 * Los grupos sucesores que nacieron con el nombre confuso.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/renombrar-sucesores.ts
 *   aplicar:  ... --aplicar
 *
 * La regla vieja buscaba el CÓDIGO del nivel ("N3") dentro de un nombre que
 * dice "Nivel 3", así que nunca lo encontraba y anteponía el código nuevo:
 *
 *   "N4 · Nivel 3. Floriana Fonseca. Junio 2026"
 *
 * Se lee como si el grupo fuera de nivel 3 y de nivel 4 a la vez. La regla ya
 * está corregida (successor-name); esto arregla los que quedaron.
 *
 * El nombre nuevo sale de la MISMA función que usa el cierre, así que lo que
 * se ve acá es exactamente lo que producirá de aquí en adelante.
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'
import { nombreDelSucesor } from '../../src/lib/studies/successor-name'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no cambia nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // Los que llevan el prefijo "CODIGO · ": la huella de la regla vieja.
  const { rows } = await c.query<{
    id: string; name: string; destino: string; origen: string | null
  }>(`
    select g.id, g.name, p.code destino, po.code origen
    from study_groups g
    join study_plans p on p.id = g.plan_id
    left join folleto_requests f on f.source_group_id = g.id
    left join study_groups go on go.id = f.origin_group_id
    left join study_plans po on po.id = go.plan_id
    where g.name ~ '^[A-Z0-9]+ · '
    order by g.created_at desc`)

  if (rows.length === 0) { console.log('No hay nombres que arreglar.'); await c.end(); return }

  const cambios: Array<{ id: string; de: string; a: string }> = []
  for (const r of rows) {
    // El nombre viejo trae el prefijo pegado: se quita para recuperar el
    // nombre del grupo origen tal como estaba.
    const sinPrefijo = r.name.replace(/^[A-Z0-9]+\s*·\s*/, '')
    // Si no se sabe de qué nivel venía, se deduce del propio nombre.
    const origen = r.origen ?? deducirOrigen(sinPrefijo)
    const nuevo = nombreDelSucesor({
      nombreOrigen: sinPrefijo, codigoOrigen: origen ?? '', codigoDestino: r.destino,
    })
    if (nuevo === r.name) continue
    console.log(`  ${r.name}`)
    console.log(`  → ${nuevo}\n`)
    cambios.push({ id: r.id, de: r.name, a: nuevo })
  }

  if (cambios.length === 0) { console.log('Nada que cambiar.'); await c.end(); return }
  if (!APLICAR) { console.log(`(dry-run) ${cambios.length} grupo(s). Correlo con --aplicar.`); await c.end(); return }

  await c.query('begin')
  try {
    for (const ch of cambios) {
      await c.query(`update study_groups set name = $2, updated_at = now() where id = $1`, [ch.id, ch.a])
    }
    await c.query('commit')
    console.log(`  ✅ renombrados: ${cambios.length}`)
  } catch (e) {
    await c.query('rollback')
    console.error('❌ rollback:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  await c.end()
}

/** De "Nivel 3. Fulano" saca "N3". Solo para los grupos donde el tiquete de
 *  folletos no dejó registrado de dónde venían. */
function deducirOrigen(nombre: string): string | null {
  const nivel = nombre.match(/Nivel\s*(\d)/i)
  if (nivel) return `N${nivel[1]}`
  const dis = nombre.match(/Disc[ií]pulos\s*(\d)/i)
  if (dis) return `DIS${dis[1]}`
  return null
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })

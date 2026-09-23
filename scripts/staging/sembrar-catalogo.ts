/**
 * INF-1 · Cargar el catálogo en una base nueva.
 *
 * Es la pieza que faltaba para levantar un ambiente de cero. Los seeds del repo
 * daban por hecho que el catálogo ya estaba —lo habían dejado los importadores
 * de CCB en producción—, así que en una base en blanco `seed-charlas` moría con
 * «event_type=charla no existe» y detrás caía todo lo demás.
 *
 * El archivo lo genera `exportar-catalogo.cjs` y está versionado.
 *
 * VA POR LA LLAVE DE SERVICIO, no por una conexión directa a Postgres. La
 * primera versión usaba `pg` y pedía `SUPABASE_DB_URL`: eso obliga a tener la
 * contraseña de la base, que en un proyecto recién creado no siempre se puede
 * recuperar —el reset por el API de gestión no surtió efecto al montar este
 * staging— y además es un secreto más para pasarse. Con la llave de servicio
 * alcanza, y es la misma que ya usan todos los otros seeds.
 *
 * ORDEN: las áreas antes que los puestos (FK `area_id`), y dentro de las áreas
 * las raíz antes que las hijas (`parent_id` apunta a `areas`).
 *
 * IDEMPOTENTE: ignora las que ya existan. Correrlo dos veces no duplica ni pisa
 * lo que alguien haya cambiado a mano.
 *
 *   npx tsx scripts/staging/sembrar-catalogo.ts
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sin archivo */ }
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const db = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const ORDEN = ['event_types', 'payment_categories', 'sedes', 'areas', 'study_plans', 'service_positions'] as const
type Fila = Record<string, unknown> & { id?: string; parent_id?: string | null }

/** Las raíz primero: `areas.parent_id` apunta a la misma tabla. */
function porJerarquia(filas: Fila[]): Fila[] {
  return [...filas].sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0))
}

async function main() {
  const datos = JSON.parse(readFileSync('supabase/seed/catalogo.json', 'utf8')) as Record<string, Fila[]>
  for (const tabla of ORDEN) {
    let filas = datos[tabla] ?? []
    if (!filas.length) { console.log(`     0  ${tabla}`); continue }
    if (tabla === 'areas') filas = porJerarquia(filas)
    const { error } = await db.from(tabla).upsert(filas, { onConflict: 'id', ignoreDuplicates: true })
    if (error) { console.error(`✗ ${tabla}: ${error.message}`); process.exit(1) }
    const { count } = await db.from(tabla).select('id', { count: 'exact', head: true })
    console.log(`  ${String(count ?? 0).padStart(4)}  ${tabla}`)
  }
  console.log('\n✓ Catálogo cargado.')
}
main().catch(e => { console.error('✗', e instanceof Error ? e.message : e); process.exit(1) })

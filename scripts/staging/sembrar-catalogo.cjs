/**
 * INF-1 · Cargar el catálogo en una base nueva.
 *
 * Es la pieza que faltaba para que un ambiente se pueda levantar de cero. Los
 * seeds del repo daban por hecho que el catálogo ya estaba —lo habían dejado
 * los importadores de CCB en producción—, así que en una base en blanco
 * `seed-charlas` moría con «event_type=charla no existe» y detrás caía todo lo
 * demás.
 *
 * El archivo lo genera `exportar-catalogo.cjs` y está versionado.
 *
 * ORDEN: las áreas antes que los puestos (FK area_id) y antes que ellas mismas
 * (`areas.parent_id` apunta a `areas`, así que se insertan primero las raíz).
 *
 * IDEMPOTENTE: `on conflict (id) do nothing`. Correrlo dos veces no duplica ni
 * pisa lo que alguien haya cambiado a mano en staging.
 *
 *   SUPABASE_DB_URL=… node scripts/staging/sembrar-catalogo.cjs
 */
const fs = require('node:fs')
const { Client } = require('pg')

const ORDEN = ['event_types', 'payment_categories', 'sedes', 'areas', 'study_plans', 'service_positions']
const ORIGEN = 'supabase/seed/catalogo.json'

function ordenarPorJerarquia(filas) {
  // `areas.parent_id` apunta a `areas`: las raíz primero, después sus hijas.
  const porId = new Map(filas.map(f => [f.id, f]))
  const listo = new Set()
  const salida = []
  const meter = (f) => {
    if (!f || listo.has(f.id)) return
    listo.add(f.id)
    if (f.parent_id && porId.has(f.parent_id)) meter(porId.get(f.parent_id))
    salida.push(f)
  }
  filas.forEach(meter)
  // `meter` empuja al padre ANTES que la hija salvo cuando la hija ya estaba
  // marcada; reordenar al final es más simple que confiar en ese recorrido.
  return salida.sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0))
}

;(async () => {
  const url = process.env.SUPABASE_DB_URL
  if (!url) { console.error('✗ Falta SUPABASE_DB_URL'); process.exit(1) }
  const datos = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
  const c = new Client({ connectionString: url, ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false } })
  await c.connect()
  for (const tabla of ORDEN) {
    let filas = datos[tabla] ?? []
    if (!filas.length) { console.log(`     0  ${tabla}`); continue }
    if (tabla === 'areas') filas = ordenarPorJerarquia(filas)
    const cols = Object.keys(filas[0])
    let puestas = 0
    for (const f of filas) {
      const vals = cols.map(k => f[k])
      const ph = cols.map((_, i) => `$${i + 1}`).join(', ')
      const r = await c.query(
        `insert into public."${tabla}" (${cols.map(k => `"${k}"`).join(', ')})
         values (${ph}) on conflict (id) do nothing`, vals)
      puestas += r.rowCount
    }
    console.log(`  ${String(puestas).padStart(4)}  ${tabla}${puestas < filas.length ? `  (${filas.length - puestas} ya estaban)` : ''}`)
  }
  await c.end()
  console.log('\n✓ Catálogo cargado.')
})().catch(e => { console.error('✗', e.message); process.exit(1) })

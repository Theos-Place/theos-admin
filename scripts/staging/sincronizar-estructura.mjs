// INF-1 · Trae de PRODUCCIÓN a STAGING la estructura de servicio: áreas,
// comités y puestos, con todos sus datos. NO trae servidores.
//
// POR QUÉ NO TRAE GENTE: staging es de datos sintéticos. Copiar `volunteers`
// arrastraría a personas reales —quién sirve dónde— a una base que se comparte
// con quien prueba. La estructura son puestos y descripciones, no personas.
//
// TAMPOCO COPIA `leader_id`. Apunta a una ficha de producción que en staging no
// existe, así que copiarlo dejaría referencias rotas. No se pierde nada: desde
// SRV-5 ese campo dejó de ser la fuente de quién encarga un comité —lo es el
// puesto «Encargado…»— y se deriva.
//
// NO BORRA NADA. Lo que exista en staging y no en producción se reporta y se
// deja: ahí viven los datos de prueba, y `[prueba] Puesto de servicio` tiene
// voluntarios colgando. Borrar por simetría se llevaría puesto el set de
// pruebas.
//
// Los IDs se CONSERVAN. Es lo que hace que `service_positions.area_id` siga
// apuntando al comité correcto sin remapear nada, y que volver a correrlo
// actualice en vez de duplicar.
//
// Uso:
//   node scripts/staging/sincronizar-estructura.mjs            # dry run
//   node scripts/staging/sincronizar-estructura.mjs --aplicar
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const APLICAR = process.argv.includes('--aplicar')

const leerEnv = (archivo) => Object.fromEntries(
  readFileSync(archivo, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)

const P = leerEnv('.env.local')
const S = leerEnv('.env.staging.local')

const REF_PRODUCCION = 'jdcyptqnznmywgjvcpxm'
if (!P.NEXT_PUBLIC_SUPABASE_URL.includes(REF_PRODUCCION)) {
  console.error('✗ .env.local no apunta a producción. Abortado.'); process.exit(1)
}
if (S.NEXT_PUBLIC_SUPABASE_URL.includes(REF_PRODUCCION)) {
  console.error('✗ .env.staging.local apunta a PRODUCCIÓN. Abortado — esto ESCRIBE.'); process.exit(1)
}

const prod = createClient(P.NEXT_PUBLIC_SUPABASE_URL, P.SUPABASE_SERVICE_ROLE_KEY)
const stg = createClient(S.NEXT_PUBLIC_SUPABASE_URL, S.SUPABASE_SERVICE_ROLE_KEY)

/** PostgREST corta en ~1000 filas, así que se pagina o el sync copia de menos
 *  en silencio — que es peor que fallar. */
async function traer(db, tabla, cols) {
  const out = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select(cols).order('id').range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const COLS_AREA = 'id, name, description, area_type, parent_id, is_active, ideal_capacity'
const COLS_PUESTO = 'id, area_id, title, description, requirements, max_volunteers, is_active,'
  + ' location, quantity, study_requirement, functions, profile, expires_at, is_featured,'
  + ' base_area_id, skills'

const areasP = await traer(prod, 'areas', COLS_AREA)
const areasS = await traer(stg, 'areas', COLS_AREA)
const puestosP = await traer(prod, 'service_positions', COLS_PUESTO)
const puestosS = await traer(stg, 'service_positions', COLS_PUESTO)

const idsS = (x) => new Set(x.map(r => r.id))
const mapaS = (x) => new Map(x.map(r => [r.id, r]))

function resumir(nombre, enProd, enStg) {
  const hay = idsS(enStg)
  const mapa = mapaS(enStg)
  const nuevos = enProd.filter(r => !hay.has(r.id))
  const cambiados = enProd.filter(r => {
    const s = mapa.get(r.id)
    if (!s) return false
    return Object.keys(r).some(k => JSON.stringify(r[k]) !== JSON.stringify(s[k]))
  })
  const soloEnStg = enStg.filter(r => !idsS(enProd).has(r.id))
  console.log(`\n${nombre}: ${enProd.length} en producción, ${enStg.length} en staging`)
  console.log(`  nuevos a insertar: ${nuevos.length}`)
  console.log(`  a actualizar:      ${cambiados.length}`)
  console.log(`  solo en staging:   ${soloEnStg.length} (NO se tocan)`)
  for (const r of soloEnStg) console.log(`     · ${r.name ?? r.title}`)
  return [...nuevos, ...cambiados]
}

const areasAEscribir = resumir('ÁREAS Y COMITÉS', areasP, areasS)
const puestosAEscribir = resumir('PUESTOS', puestosP, puestosS)

if (!APLICAR) {
  console.log('\n🔎 DRY RUN — no se escribió nada. Corré con --aplicar.')
  process.exit(0)
}

// Las ÁREAS van primero y en dos pasadas: `parent_id` apunta a otra fila de la
// misma tabla, así que insertar un comité antes que su área rompe la FK.
const sinPadre = areasAEscribir.map(a => ({ ...a, parent_id: null }))
for (const tanda of [sinPadre]) {
  for (let i = 0; i < tanda.length; i += 100) {
    const { error } = await stg.from('areas').upsert(tanda.slice(i, i + 100), { onConflict: 'id' })
    if (error) throw error
  }
}
// Segunda pasada: ahora que todas existen, se les pone el padre.
for (let i = 0; i < areasAEscribir.length; i += 100) {
  const { error } = await stg.from('areas').upsert(areasAEscribir.slice(i, i + 100), { onConflict: 'id' })
  if (error) throw error
}
console.log(`\n✓ ${areasAEscribir.length} áreas/comités`)

for (let i = 0; i < puestosAEscribir.length; i += 100) {
  const { error } = await stg.from('service_positions').upsert(puestosAEscribir.slice(i, i + 100), { onConflict: 'id' })
  if (error) throw error
}
console.log(`✓ ${puestosAEscribir.length} puestos`)

const { count: vol } = await stg.from('volunteers').select('id', { count: 'exact', head: true })
console.log(`\nvoluntarios en staging: ${vol} (intactos — este script no los toca)`)

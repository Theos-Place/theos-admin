// INF-1 · Pone UNA persona de prueba en cada puesto de servicio de STAGING.
//
// Para qué: las pantallas de servidores —el detalle del comité, los conteos por
// área, el export de estructura— se ven vacías con 357 puestos y una sola
// persona asignada. Sin gente no se puede probar nada de eso.
//
// CADA PUESTO RECIBE SU PROPIA FICHA, no se reparten unas pocas entre muchos
// puestos. Con 53 fichas y 357 puestos habría que repetir a cada una siete
// veces, y entonces los conteos de «cuánta gente sirve» dejarían de parecerse a
// la realidad, que es justo lo que se quiere mirar.
//
// LA FICHA SE DERIVA DEL ID DEL PUESTO, no de un contador. Así el script es
// idempotente aunque cambie el orden o se agreguen puestos: volver a correrlo
// no duplica a nadie y solo llena lo que falte.
//
// Marcadas `[prueba]` como el resto del set, y con correo en `.invalid` — un
// TLD reservado que NO EXISTE, así que ni por error puede salir un envío hacia
// una dirección real.
//
// Uso:
//   node scripts/staging/sembrar-servidores.mjs            # dry run
//   node scripts/staging/sembrar-servidores.mjs --aplicar
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const APLICAR = process.argv.includes('--aplicar')

const env = Object.fromEntries(
  readFileSync('.env.staging.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)

const REF_PRODUCCION = 'jdcyptqnznmywgjvcpxm'
if (env.NEXT_PUBLIC_SUPABASE_URL.includes(REF_PRODUCCION)) {
  console.error('✗ Esto apunta a PRODUCCIÓN. Abortado — crea fichas y asignaciones.')
  process.exit(1)
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}\n`)

// Nombres corrientes de Costa Rica, para que las pantallas se vean como se van
// a ver de verdad. La combinación sale del id del puesto, así que es estable.
const NOMBRES = [
  'Ana', 'Luis', 'María', 'Carlos', 'Sofía', 'Diego', 'Laura', 'José', 'Valeria', 'Andrés',
  'Camila', 'Mauricio', 'Daniela', 'Esteban', 'Gabriela', 'Rodrigo', 'Natalia', 'Fernando',
  'Paola', 'Alberto', 'Karla', 'Jorge', 'Melissa', 'Ricardo', 'Adriana', 'Óscar',
]
const APELLIDOS = [
  'Mora', 'Jiménez', 'Rodríguez', 'Vargas', 'Solís', 'Araya', 'Castro', 'Rojas', 'Chaves',
  'Ramírez', 'Fernández', 'Alfaro', 'Quesada', 'Herrera', 'Villalobos', 'Sánchez', 'Cordero',
  'Brenes', 'Montero', 'Arias', 'Salas', 'Ugalde', 'Barrantes', 'Zúñiga',
]

/** Entero estable a partir del uuid del puesto: mismo puesto, misma persona. */
const semilla = (id) => [...id.replace(/-/g, '')].reduce((a, c) => (a * 31 + parseInt(c, 16)) >>> 0, 7)

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

async function traer(tabla, cols, filtro = (q) => q) {
  const out = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await filtro(db.from(tabla).select(cols)).order('id').range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const puestos = await traer('service_positions', 'id, title, area_id')
const activos = await traer('volunteers', 'position_id', (q) => q.eq('status', 'active'))
const yaTienen = new Set(activos.map(v => v.position_id))
const existentes = await traer('members', 'id, email')
const fichaPorCorreo = new Map(existentes.map(m => [m.email, m.id]))

const faltan = puestos.filter(p => !yaTienen.has(p.id))

console.log(`puestos:            ${puestos.length}`)
console.log(`ya con alguien:     ${puestos.length - faltan.length}`)
console.log(`a llenar:           ${faltan.length}`)

const plan = faltan.map((p, i) => {
  const s = semilla(p.id)
  const nombre = NOMBRES[s % NOMBRES.length]
  const i1 = (s >>> 5) % APELLIDOS.length
  // +1 sobre el primero para que nadie salga «Montero Montero»: con dos índices
  // independientes coincidían cada 24 fichas.
  const i2 = (i1 + 1 + ((s >>> 11) % (APELLIDOS.length - 1))) % APELLIDOS.length
  const ap1 = APELLIDOS[i1]
  const ap2 = APELLIDOS[i2]
  return {
    posicion: p,
    first_name: `[prueba] ${nombre}`,
    last_name: `${ap1} ${ap2}`,
    // El correo lleva el id del puesto: es lo que hace idempotente al script y
    // permite rastrear de qué puesto salió cada ficha.
    email: `${sinTildes(nombre)}.${sinTildes(ap1)}.${p.id.slice(0, 8)}@prueba.theosplace.invalid`,
    phone: `8100-${String(i + 1).padStart(4, '0')}`,
  }
})

console.log('\nejemplo de lo que se crearía:')
for (const x of plan.slice(0, 4)) {
  console.log(`  ${x.first_name} ${x.last_name}`.padEnd(42), '→', x.posicion.title)
}

if (!APLICAR) {
  console.log('\n🔎 DRY RUN — no se escribió nada. Corré con --aplicar.')
  process.exit(0)
}

const hoy = new Date().toISOString().slice(0, 10)
let fichasNuevas = 0
let asignaciones = 0

for (let i = 0; i < plan.length; i += 100) {
  const tanda = plan.slice(i, i + 100)

  const porCrear = tanda.filter(x => !fichaPorCorreo.has(x.email))
  if (porCrear.length > 0) {
    const { data, error } = await db.from('members').insert(
      porCrear.map(x => ({
        first_name: x.first_name, last_name: x.last_name,
        email: x.email, phone: x.phone, is_active: true,
      })),
    ).select('id, email')
    if (error) throw error
    for (const m of data) fichaPorCorreo.set(m.email, m.id)
    fichasNuevas += data.length
  }

  const { error: eVol } = await db.from('volunteers').insert(
    tanda.map(x => ({
      member_id: fichaPorCorreo.get(x.email),
      position_id: x.posicion.id,
      status: 'active',
      start_date: hoy,
      notes: 'Sembrado por scripts/staging/sembrar-servidores.mjs',
    })),
  )
  if (eVol) throw eVol
  asignaciones += tanda.length
  process.stdout.write(`\r  ${asignaciones}/${plan.length}`)
}

console.log(`\n\n✓ ${fichasNuevas} fichas nuevas · ${asignaciones} asignaciones`)

const { count: conGente } = await db.from('volunteers').select('position_id', { count: 'exact', head: true }).eq('status', 'active')
console.log(`voluntariados activos en staging: ${conGente}`)

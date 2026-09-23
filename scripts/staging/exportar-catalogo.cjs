/**
 * INF-1 · Sacar el CATÁLOGO de producción a un archivo versionado.
 *
 * POR QUÉ EXISTE. Levantando la primera base desde cero se vio que los seeds no
 * pueden arrancar un ambiente nuevo: están escritos contra producción, que ya
 * tenía el catálogo cargado por los importadores de CCB. En una base en blanco,
 * `seed-charlas` muere con «event_type=charla no existe», y detrás de eso
 * fallan las charlas, los grupos y todo el set de prueba.
 *
 * QUÉ SE LLEVA, y por qué esto no contradice «staging con datos sintéticos»:
 * solo CONFIGURACIÓN —tipos de evento, sedes, áreas, planes de estudio, puestos
 * de servicio, categorías de pago—. Son ~500 filas y ninguna es de una persona.
 * Lo que identifica gente (miembros, donaciones, asistencias) NO sale de acá:
 * eso lo inventa `seed-datos-de-prueba`.
 *
 * LAS DOS COLUMNAS QUE SÍ APUNTAN A PERSONAS —`areas.leader_id` y
 * `study_plans.mentor_id`, las dos FK a `members`— se exportan en NULO. No es
 * solo higiene: en la base nueva ese miembro no existe y la FK reventaría.
 *
 *   node scripts/staging/exportar-catalogo.cjs
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

/** Tabla → columnas que se ponen en nulo por apuntar a una persona. */
const CATALOGO = {
  event_types: [],
  payment_categories: [],
  sedes: [],
  areas: ['leader_id'],
  study_plans: ['mentor_id'],
  service_positions: [],
}
const DESTINO = 'supabase/seed/catalogo.json'

/**
 * Los textos libres del catálogo TRAEN CORREOS. No lo supuse: la primera
 * exportación salió con cuatro —`facturacion@`, `finanzas@` y el de una
 * persona con nombre— metidos en las «funciones» de varios puestos de
 * servicio, del estilo «mandar la factura a …».
 *
 * Tres son direcciones de rol y una es de alguien. Se tapan todas igual: este
 * archivo se versiona, y lo que entra al historial de git no vuelve a salir.
 * Para lo que staging necesita —la FORMA del catálogo— la dirección real no
 * aporta nada.
 */
const CORREO = /[\w.+-]+@[\w-]+\.[\w.]+/g
const TAPADO = 'contacto@ejemplo.invalid'
function taparCorreos(valor) {
  return typeof valor === 'string' ? valor.replace(CORREO, TAPADO) : valor
}

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const salida = {}
  for (const [tabla, anular] of Object.entries(CATALOGO)) {
    const { rows } = await c.query(`select * from public."${tabla}" order by 1`)
    let tapados = 0
    for (const r of rows) {
      for (const col of anular) r[col] = null
      for (const [col, val] of Object.entries(r)) {
        const limpio = taparCorreos(val)
        if (limpio !== val) { r[col] = limpio; tapados++ }
      }
    }
    if (tapados) console.log(`        ↳ ${tapados} campos con correo, tapados`)
    salida[tabla] = rows
    console.log(`  ${String(rows.length).padStart(4)}  ${tabla}${anular.length ? `  (${anular.join(', ')} → null)` : ''}`)
  }
  fs.writeFileSync(DESTINO, JSON.stringify(salida, null, 2) + '\n')
  console.log(`\n✓ ${DESTINO}`)
  await c.end()
})().catch(e => { console.error('✗', e.message); process.exit(1) })

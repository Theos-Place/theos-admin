/**
 * Unificar las series de charlas: el mapeo, en un solo lugar.
 *
 * NO se renombra ningún evento ni se inventa un campo `series_key`. El reporte
 * ya agrupa por `coalesce(sede.name, e.title)`, y las 14 series nuevas ya traen
 * su `sede_id` correcto. Lo único que falta es ponerle `sede_id` a los 3.553
 * eventos históricos: con eso el reporte une las series solo, y el título de
 * cada evento queda histórico y fiel.
 *
 * El renombre fue en bloque entre el 9 y el 13 de setiembre de 2026. Cada par
 * viejo→nuevo tiene rangos consecutivos sin traslape y el MISMO día de la
 * semana, que es la prueba de que es un renombre y no dos series distintas.
 */

/** título histórico → código de sede al que pertenece. */
const MAPEO = {
  'Charla Meridiano':        'meridiano',            // mar, hasta 01-set
  'Charla Meridiano Mié':    'meridiano-miercoles',  // mié, hasta 02-set
  'Charla Heredia':          'pedregal-miercoles',   // mié, hasta 02-set
  'Charla Antares':          'antares',
  'Charla Cartago':          'cartago',
  'Charla Liberia':          'liberia',
  'Charla Pérez Zeledón':    'perez-zeledon',
  'Charla Guápiles':         'guapiles',
  'Charla Alajuela':         'alajuela',
  'Charla Potrero':          'potrero',
  'Charla Madrid Home':      'madrid-home',          // jue, hasta 03-set
  'Charla Madrid':           'madrid',               // dom, hasta 06-set
  'Charla United':           'united',               // dom, hasta 06-set → Pedregal Domingo
}

/**
 * Los Youth quedan FUERA del mapeo de sede_id a propósito, y no es un olvido.
 *
 * Son de la misma sede pero de un evento distinto, y se quieren seguir viendo
 * aparte en el reporte. Como el reporte agrupa por nombre de sede cuando el
 * evento tiene sede_id, dárselo los fundiría con la charla madre: Pedregal
 * Miércoles saltaba de 19.216 a 22.344 check-ins y el youth desaparecía de la
 * vista.
 *
 * Que no lleven sede_id NO los deja fuera de la sede de la persona: eso lo
 * decide charla_sede_code(title), que es otro camino, y ahí sí apuntan a su
 * sede. O sea: cuentan para la sede de quien asiste, y se ven aparte en el
 * reporte. Las dos cosas a la vez.
 */
const YOUTH_APARTE = {
  'Heredia Youth': 'pedregal-miercoles',
  'United Youth':  'united',
  'Cartago Youth': 'cartago',
}

/** Series cerradas: no se mapean, se quedan con su título como serie propia. */
const CERRADAS = ['Youth United Este', 'United Este']

/** Sin decisión todavía: no se tocan. */
const SIN_DECIDIR = ['Colegiales', 'Entre Mujeres', 'Charla Life Escalante']

/** La sede que sobrevive de las dos que se llaman igual, y la que se retira. */
const FUSION_DE_SEDES = { conservar: 'pedregal-miercoles', retirar: 'heredia' }

module.exports = { MAPEO, YOUTH_APARTE, CERRADAS, SIN_DECIDIR, FUSION_DE_SEDES }

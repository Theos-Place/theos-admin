/**
 * DAT-14 · Conciliar el histórico de estudios contra los process queues de CCB.
 *
 * NO ESCRIBE NADA. Mide y reporta; aplicar es otro paso, con respaldo.
 *
 * El criterio (qué cola cuenta, a qué plan va, en qué casilla cae cada
 * persona-plan) vive en src/lib/studies/conciliacion-ccb.ts, que tiene tests.
 * Acá solo está lo que necesita la base de datos.
 *
 *   node scripts/dat14-2026-10-13/conciliar.cjs
 */
const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const CSV = 'data-import/ccb-process-queues-historico-2026-10-13.csv'
const SALIDA = 'scripts/dat14-2026-10-13/conciliacion.json'

// El criterio, transcrito del módulo con tests. Se lee de ahí para que no
// existan dos listas: el .ts no se puede require() desde un .cjs sin
// compilarlo, así que se extrae del propio archivo y se valida el conteo.
function criterio() {
  const src = fs.readFileSync('src/lib/studies/conciliacion-ccb.ts', 'utf8')
  const bloque = src.match(/PLAN_POR_COLA[^=]*= \{([\s\S]*?)\n\}/)[1]
  const plan = {}
  for (const m of bloque.matchAll(/^\s*'([^']+)': '([A-Z0-9]+)',$/gm)) plan[m[1]] = m[2]
  const sinPlan = [...src.match(/COLAS_SIN_PLAN[^=]*= \[([\s\S]*?)\n\]/)[1]
    .matchAll(/'([^']+)'/g)].map(m => m[1])
  if (Object.keys(plan).length < 30) throw new Error('No se leyó PLAN_POR_COLA')
  return { plan, sinPlan }
}

/** CSV con comillas y comas adentro: parser mínimo, sin dependencias. */
function leerCsv(ruta) {
  const texto = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '')
  const filas = []
  let campo = '', fila = [], comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') comillas = false
      else campo += c
    } else if (c === '"') comillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const cab = filas.shift()
  return filas.filter(f => f.length === cab.length)
    .map(f => Object.fromEntries(cab.map((k, i) => [k, f[i]])))
}

const pct = (n, d) => d ? `${((n / d) * 100).toFixed(1)}%` : '—'

;(async () => {
  const { plan: PLAN_POR_COLA, sinPlan: COLAS_SIN_PLAN } = criterio()
  const esReprueba = cola => /^\s*reprueba\b/i.test(cola)

  const crudas = leerCsv(CSV)
  console.log(`\n=== EL ARCHIVO ===`)
  console.log(`filas            ${crudas.length}`)

  const reprueba = crudas.filter(r => esReprueba(r['Queue Name']))
  const noDone = crudas.filter(r => r.Status !== 'Done')
  const sinFecha = crudas.filter(r => !/^\d{4}-\d{2}-\d{2}$/.test(r.Due) || r.Due.startsWith('0000'))
  console.log(`colas «Reprueba» ${reprueba.length}  (ignoradas por instrucción)`)
  console.log(`no «Done»        ${noDone.length}`)
  console.log(`sin fecha válida ${sinFecha.length}`)

  const colasDesconocidas = new Map()
  const util = []
  // Las «Reprueba» aparte: no son aprobación, pero son la prueba de la
  // reprobación. Ver el comentario largo en conciliacion-ccb.ts.
  const reprobacionesCcb = new Map()
  for (const r of crudas) {
    if (!esReprueba(r['Queue Name'])) continue
    const e = String(r['Ind ID']).trim()
    if (!reprobacionesCcb.has(e)) reprobacionesCcb.set(e, [])
    reprobacionesCcb.get(e).push(r.Due)
  }
  for (const r of crudas) {
    const cola = r['Queue Name'].trim()
    if (esReprueba(cola)) continue
    if (COLAS_SIN_PLAN.includes(cola)) continue
    const plan = PLAN_POR_COLA[cola]
    if (!plan) { colasDesconocidas.set(cola, (colasDesconocidas.get(cola) || 0) + 1); continue }
    const ext = String(r['Ind ID']).trim()
    if (!ext) continue
    util.push({ ext, plan, cola, due: r.Due, nombre: r['Individual Name'] })
  }
  if (colasDesconocidas.size) {
    console.log(`\nCOLAS SIN MAPEO (se reportan, no se adivinan):`)
    for (const [k, v] of colasDesconocidas) console.log(`  ${v}  ${k}`)
  }
  const ultimaCola = util.map(r => r.due).filter(d => d > '2000').sort().at(-1)
  console.log(`\nfilas útiles     ${util.length}`)
  console.log(`última cola      ${ultimaCola}   ← después de esta fecha CCB no prueba nada`)

  const c = nuevoCliente(); await c.connect()

  // 1 · Resolver external_id SIEMPRE con member_por_external_id(): la fusión
  //     de duplicados deja el id en la ficha muerta y el acceso directo a
  //     members.external_id devuelve a la persona inactiva (AGENTS.md).
  const exts = [...new Set(util.map(r => r.ext))]
  const { rows: resueltos } = await c.query(
    `select e as ext, member_por_external_id(e) as member_id
       from unnest($1::text[]) e`, [exts])
  const porExt = new Map(resueltos.map(r => [r.ext, r.member_id]))
  const noResuelven = resueltos.filter(r => !r.member_id)
  console.log(`\n=== EL CRUCE ===`)
  console.log(`external_id distintos  ${exts.length}`)
  console.log(`no resuelven a ficha   ${noResuelven.length}  (${pct(noResuelven.length, exts.length)})`)

  // Cuántos de esos habrían salido mal por la vía directa — la que prohíbe AGENTS.md.
  const { rows: [dif] } = await c.query(
    `select count(*) filter (where d.id is distinct from member_por_external_id(e)) as distintos
       from unnest($1::text[]) e left join members d on d.external_id = e`, [exts])
  console.log(`habrían dado otra ficha con members.external_id a secas: ${dif.distintos}`)

  // 2 · Lo que el sistema afirma.
  // OJO: el histórico de CCB se cargó SIN grupo — 22.331 matrículas llevan el
  //      plan y el resultado pero ningún study_group. Un `join study_groups`
  //      las desaparece, y con ellas el 60% de la historia: la primera corrida
  //      de esto dio 17.562 «cierres nunca registrados» que en realidad sí
  //      estaban. Por eso el join va a la IZQUIERDA y el plan sale de la
  //      matrícula, no del grupo.
  const { rows: matriculas } = await c.query(`
    select se.id, se.member_id, p.code as plan, se.status,
           coalesce(se.completed_at::date, g.ends_at)::text as cierre,
           g.id as group_id, coalesce(g.name, '(sin grupo · histórico)') as grupo,
           m.first_name || ' ' || m.last_name as persona, m.external_id,
           se.es_externo
      from study_enrollments se
      left join study_groups g on g.id = se.group_id
      join study_plans  p on p.id = coalesce(se.plan_id, g.plan_id)
      join members      m on m.id = se.member_id
     where se.status in ('completed','reprobado','en_revision')`)
  console.log(`matrículas con resultado en el sistema: ${matriculas.length}`)

  // 3 · Casillas. La unidad es persona + plan: CCB no guarda el grupo, así
  //     que no se puede conciliar matrícula por matrícula.
  const enCcb = new Set()
  const ccbPorLlave = new Map()
  for (const r of util) {
    const mid = porExt.get(r.ext)
    if (!mid) continue
    const k = `${mid}|${r.plan}`
    enCcb.add(k)
    if (!ccbPorLlave.has(k)) ccbPorLlave.set(k, [])
    ccbPorLlave.get(k).push(r)
  }

  const personasEnCcb = new Set([...enCcb].map(k => k.split('|')[0]))
  const casillas = { ok: [], resultado_distinto: [], sin_respaldo: [], fuera_de_alcance: [] }
  const vistasEnSistema = new Set()
  for (const m of matriculas) {
    const k = `${m.member_id}|${m.plan}`
    vistasEnSistema.add(k)
    const tiene = enCcb.has(k)
    if (!tiene && m.cierre && m.cierre > ultimaCola) { casillas.fuera_de_alcance.push(m); continue }
    if (!tiene) casillas.sin_respaldo.push(m)
    else if (m.status === 'completed') casillas.ok.push(m)
    else casillas.resultado_distinto.push(m)
  }
  const cierreNoRegistrado = [...ccbPorLlave.entries()]
    .filter(([k]) => !vistasEnSistema.has(k))
    .map(([k, v]) => ({ member_id: k.split('|')[0], plan: k.split('|')[1], filas: v }))

  const total = matriculas.length
  console.log(`\n=== LA CONCILIACIÓN (persona + plan) ===`)
  console.log(`ok · el sistema aprueba y CCB respalda      ${casillas.ok.length}  (${pct(casillas.ok.length, total)})`)
  console.log(`resultado DISTINTO · CCB la aprobó          ${casillas.resultado_distinto.length}`)
  console.log(`SIN RESPALDO · candidato a error de unión   ${casillas.sin_respaldo.length}`)
  console.log(`fuera de alcance · cerrada después de CCB   ${casillas.fuera_de_alcance.length}`)
  console.log(`cierre NUNCA registrado · está en CCB       ${cierreNoRegistrado.length}`)

  const porEstado = arr => {
    const n = {}
    for (const x of arr) n[x.status] = (n[x.status] || 0) + 1
    return n
  }
  console.log(`\nsin respaldo, por estado:`, porEstado(casillas.sin_respaldo))
  console.log(`resultado distinto, por estado:`, porEstado(casillas.resultado_distinto))
  console.log(`fuera de alcance, por estado:`, porEstado(casillas.fuera_de_alcance))

  // ¿De qué planes son los «sin respaldo»? Un plan que NUNCA fue cola de CCB
  // —las campañas, por ejemplo— no tiene cómo tener respaldo, y meterlo en la
  // misma bolsa que un Nivel 1 sin cola confunde las dos cosas.
  const planesEnCcb = new Set(util.map(r => r.plan))
  const porPlan = {}
  for (const m of casillas.sin_respaldo) {
    const k = m.plan
    porPlan[k] = porPlan[k] || { plan: k, n: 0, colaExiste: planesEnCcb.has(k), personaEnCcb: 0 }
    porPlan[k].n++
    if (personasEnCcb.has(m.member_id)) porPlan[k].personaEnCcb++
  }
  const filasPlan = Object.values(porPlan).sort((a, b) => b.n - a.n)
  console.log(`\n=== «sin respaldo», por plan ===`)
  console.log(`plan      n     ¿el plan fue cola en CCB?   de esos, la persona SÍ está en CCB`)
  for (const f of filasPlan) {
    console.log(`${f.plan.padEnd(10)}${String(f.n).padStart(5)}   ${(f.colaExiste ? 'sí' : 'NO — nunca existió').padEnd(26)} ${f.personaEnCcb}`)
  }
  const sinColaPosible = filasPlan.filter(f => !f.colaExiste).reduce((a, f) => a + f.n, 0)
  console.log(`\nde los ${casillas.sin_respaldo.length} «sin respaldo», ${sinColaPosible} son de planes que NUNCA fueron cola de CCB`)
  console.log(`quedan ${casillas.sin_respaldo.length - sinColaPosible} realmente comparables`)

  // LO COMPARABLE. Dos filtros, y los dos son por qué el número bajó de 9.114:
  //  · el plan tiene que haber sido cola en CCB (las campañas nunca lo fueron);
  //  · la persona tiene que aparecer en CCB al menos una vez — si no, su
  //    ausencia no dice nada: pudo entrar después de que CCB dejó de usarse.
  const comparable = m => planesEnCcb.has(m.plan) && personasEnCcb.has(m.member_id)
  const comparables = casillas.sin_respaldo.filter(comparable)
  const noJuzgables = casillas.sin_respaldo.filter(m => !comparable(m))
  console.log(`\n=== LO QUE QUEDA EN PIE ===`)
  console.log(`sin respaldo, comparables      ${comparables.length}`, porEstado(comparables))
  console.log(`no juzgables por CCB           ${noJuzgables.length}  (campaña, o persona que CCB no conoce)`)

  const enRevisionSinRespaldo = comparables.filter(m => m.status === 'en_revision')
  const reprobadoSinRespaldo = comparables.filter(m => m.status === 'reprobado')
  const completedSinRespaldo = comparables.filter(m => m.status === 'completed')
  console.log(`\n→ en_revision sin process queue: ${enRevisionSinRespaldo.length}  (propuesta: 'cancelada', NO 'dropped')`)
  console.log(`→ reprobado  sin process queue: ${reprobadoSinRespaldo.length}  (uno por uno, los confirma Floriana)`)
  console.log(`→ completed  sin process queue: ${completedSinRespaldo.length}  (una aprobación que CCB no respalda)`)

  const porAno = arr => {
    const n = {}
    for (const x of arr) n[(x.cierre || '????').slice(0, 4)] = (n[(x.cierre || '????').slice(0, 4)] || 0) + 1
    return Object.entries(n).sort()
  }
  console.log(`\nen_revision, por año de cierre:`, JSON.stringify(porAno(enRevisionSinRespaldo)))
  console.log(`reprobado,   por año de cierre:`, JSON.stringify(porAno(reprobadoSinRespaldo)))

  // Un reprobado se respalda con su cola «Reprueba», no con una de aprobación.
  // La cola no dice el plan, así que se exige el mismo año ±1.
  const conReprueba = m => {
    const fechas = reprobacionesCcb.get(String(m.external_id)) || []
    const ano = +(m.cierre || '0').slice(0, 4)
    return fechas.some(f => Math.abs(+f.slice(0, 4) - ano) <= 1)
  }
  const reprobadoRespaldado = reprobadoSinRespaldo.filter(conReprueba)
  const reprobadoSinNada = reprobadoSinRespaldo.filter(m => !conReprueba(m))
  console.log(`\n   de esos ${reprobadoSinRespaldo.length}: ${reprobadoRespaldado.length} tienen cola «Reprueba» → la reprobación es real`)
  console.log(`   quedan ${reprobadoSinNada.length} sin nada en CCB que la respalde:`)
  for (const m of reprobadoSinNada) {
    console.log(`  ${(m.cierre || '—').padEnd(11)} ${m.plan.padEnd(8)} ${m.persona.padEnd(34)} ${m.grupo}`)
  }

  console.log(`\n=== los ${casillas.resultado_distinto.length} con resultado DISTINTO (el sistema reprueba, CCB aprueba) ===`)
  for (const m of casillas.resultado_distinto) {
    console.log(`  ${(m.cierre || '—').padEnd(11)} ${m.plan.padEnd(8)} ${m.persona.padEnd(34)} ${m.grupo}`)
  }

  console.log(`\n=== los ${cierreNoRegistrado.length} cierres de CCB que el sistema no tiene ===`)
  for (const x of cierreNoRegistrado) {
    const f = x.filas[0]
    console.log(`  ${f.due.padEnd(11)} ${x.plan.padEnd(8)} ${f.nombre.padEnd(34)} ext ${f.ext}`)
  }

  fs.writeFileSync(SALIDA, JSON.stringify({
    generado: new Date().toISOString(), archivo: CSV, ultimaCola,
    resumen: {
      filas: crudas.length, reprueba: reprueba.length, utiles: util.length,
      extDistintos: exts.length, noResuelven: noResuelven.map(r => r.ext),
      ok: casillas.ok.length, resultadoDistinto: casillas.resultado_distinto.length,
      sinRespaldo: casillas.sin_respaldo.length,
      fueraDeAlcance: casillas.fuera_de_alcance.length,
      cierreNoRegistrado: cierreNoRegistrado.length,
    },
    porPlan: filasPlan, noJuzgables: noJuzgables.length,
    enRevisionSinRespaldo, reprobadoSinRespaldo, reprobadoSinNada, completedSinRespaldo,
    cierreNoRegistrado,
    resultadoDistinto: casillas.resultado_distinto,
  }, null, 2))
  console.log(`\ndetalle en ${SALIDA}`)
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

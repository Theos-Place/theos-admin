/**
 * DAT-14 · Lo que el export de CCB SÍ permite arreglar.
 *
 * Decisión de Floriana (2026-10-13): de este cruce no sale una limpieza
 * masiva. Las 321 `en_revision` sin respaldo NO se cancelan — el export sirve
 * para confirmar dudas, no para borrar historia. Lo que sí se hace es sumar
 * lo que a CCB le consta y al sistema le falta:
 *
 *   A · Los 40 cierres que CCB tiene y el sistema no tiene de ninguna forma.
 *   B · Las fechas que faltan: 2.132 matrículas `completed` sin ninguna fecha
 *       (ni completed_at ni fin de grupo) para las que CCB sí tiene una.
 *   C · Los casos donde CCB aprobó y el sistema dice reprobado — pero caso por
 *       caso, porque NO son lo mismo (ver ARREGLOS_DEL_4 más abajo).
 *
 *   node scripts/dat14-2026-10-13/aplicar.cjs            # dry run, hace ROLLBACK
 *   node scripts/dat14-2026-10-13/aplicar.cjs --aplicar  # COMMIT
 */
const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const CSV = 'data-import/ccb-process-queues-historico-2026-10-13.csv'
const RESPALDO = 'scripts/dat14-2026-10-13/respaldo-antes-de-aplicar.json'
const APLICAR = process.argv.includes('--aplicar')
const NOTA = 'DAT-14 · cierre tomado del export de process queues de CCB (2026-10-13)'

/**
 * LOS CUATRO «RESULTADO DISTINTO», UNO POR UNO.
 *
 * El cruce los junta por persona+plan y eso es demasiado grueso: CCB no
 * guarda el grupo, así que «reprobó» y «aprobó» pueden ser dos intentos
 * distintos del mismo estudio y las dos cosas ser ciertas. Mirando las fechas,
 * los cuatro resultaron ser tres casos diferentes:
 *
 * · Mailyn Ulate — reprobó Evangelismo el 27-jul-2026 y CCB se lo aprueba el
 *   25-ago, un mes después y sin grupo nuevo de por medio: es el MISMO intento,
 *   terminó lo que debía y el sistema no se enteró. → se corrige el estado.
 * · Roberto Acosta — reprobó Panorama en jun-2014 y CCB se lo aprueba en
 *   abr-2015: son DOS intentos. Cambiarle el de 2014 le borraría que reprobó.
 *   → se agrega la aprobación de 2015 y la reprobación se queda.
 * · Byron Pérez — el sistema dice reprobado N4 en dic-2025 y CCB tiene una
 *   «Reprueba Nivel 1 - 4» en ene-2026 que lo confirma; la aprobación de CCB
 *   es de 2022, otro intento. El sistema TIENE RAZÓN. → no se toca.
 * · José Manuel Avendaño — ya tiene las dos filas (reprobado 2022, completed
 *   2025). La historia está completa. → no se toca.
 */
const ARREGLOS_DEL_4 = {
  '16617': { accion: 'corregir', plan: 'EVM', fecha: '2026-08-25', quien: 'Mailyn Ulate Chavez' },
  '366': { accion: 'agregar', plan: 'PAN', fecha: '2015-04-08', quien: 'Roberto Acosta Acosta' },
  '15442': { accion: 'dejar', quien: 'Byron Perez Camareno' },
  '10661': { accion: 'dejar', quien: 'Jose Manuel Avendano Molina' },
}

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

/** La fecha real vive en «Queue Days»; `Due` es el vencimiento. Ver el
 *  comentario largo de `fechaDeCompletado` en conciliacion-ccb.ts. */
const MES_CCB = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', set: '09', sep: '09', sept: '09', oct: '10', nov: '11', dic: '12' }
function fechaDeCompletado(queueDays) {
  const m = (queueDays ?? '').match(/completed on (\d{1,2}) ([a-zA-Zé]{3,4})\.? (\d{4})/)
  if (!m) return null
  const mes = MES_CCB[m[2].toLowerCase()]
  return mes ? `${m[3]}-${mes}-${m[1].padStart(2, '0')}` : null
}

function mapeoDePlanes() {
  const src = fs.readFileSync('src/lib/studies/conciliacion-ccb.ts', 'utf8')
  const bloque = src.match(/PLAN_POR_COLA[^=]*= \{([\s\S]*?)\n\}/)[1]
  const plan = {}
  for (const m of bloque.matchAll(/^\s*'([^']+)': '([A-Z0-9]+)',$/gm)) plan[m[1]] = m[2]
  if (Object.keys(plan).length < 30) throw new Error('No se leyó PLAN_POR_COLA')
  return plan
}

;(async () => {
  const PLAN_POR_COLA = mapeoDePlanes()
  const c = nuevoCliente(); await c.connect()

  // --- CCB: la fecha más temprana por persona+plan ------------------------
  // Más temprana y no la última: cuando hay varias, la primera es la que
  // corresponde a la matrícula más vieja, que es la que está sin fecha.
  const crudas = leerCsv(CSV).filter(r => !/^\s*reprueba\b/i.test(r['Queue Name']))
  const filas = crudas.map(r => ({
    ext: String(r['Ind ID']).trim(),
    plan: PLAN_POR_COLA[r['Queue Name'].trim()],
    due: fechaDeCompletado(r['Queue Days']),
    nombre: r['Individual Name'],
  })).filter(r => r.plan && r.ext)
  console.log(`filas de CCB con fecha real de completado: ${filas.filter(r => r.due).length} de ${crudas.length}`)

  const exts = [...new Set(filas.map(r => r.ext))]
  const { rows: res } = await c.query(
    'select e as ext, member_por_external_id(e) mid from unnest($1::text[]) e', [exts])
  const mid = new Map(res.map(r => [r.ext, r.mid]))

  // Una fila sin fecha real igual prueba que el estudio se aprobó: vale para
  // saber QUE pasó, no CUÁNDO. Gana la que tenga fecha; si ninguna la tiene,
  // la matrícula entra sin fecha, que es lo honesto.
  const ccb = new Map()
  for (const r of filas) {
    const m = mid.get(r.ext); if (!m) continue
    const k = `${m}|${r.plan}`
    const previa = ccb.get(k)
    if (!previa) ccb.set(k, { ...r, mid: m })
    else if (r.due && (!previa.due || r.due < previa.due)) ccb.set(k, { ...r, mid: m })
  }

  // --- lo que el sistema tiene, en CUALQUIER estado -----------------------
  const { rows: todas } = await c.query(`
    select se.id, se.member_id, p.code plan, se.status,
           se.completed_at, se.enrolled_at, g.ends_at, se.group_id,
           m.first_name || ' ' || m.last_name persona, m.external_id
      from study_enrollments se
      left join study_groups g on g.id = se.group_id
      join study_plans p on p.id = coalesce(se.plan_id, g.plan_id)
      join members m on m.id = se.member_id`)
  const porLlave = new Map()
  for (const t of todas) {
    const k = `${t.member_id}|${t.plan}`
    if (!porLlave.has(k)) porLlave.set(k, [])
    porLlave.get(k).push(t)
  }

  const { rows: planes } = await c.query('select id, code from study_plans')
  const planId = new Map(planes.map(p => [p.code, p.id]))

  // --- A · los cierres que no están de ninguna forma ----------------------
  const aInsertar = [...ccb.entries()]
    .filter(([k]) => !porLlave.has(k))
    .map(([, v]) => v)

  const sinFechaAlInsertar = aInsertar.filter(x => !x.due).length

  // --- B · las fechas que faltan ------------------------------------------
  // Se mide igual aunque dé cero: el resultado ES el hallazgo. Las 2.132
  // `completed` sin fecha del sistema son exactamente las filas que en CCB
  // tampoco traen fecha de completado — el hueco vino de ahí y no hay de
  // dónde sacarlo. Medido el 2026-10-13: 0 recuperables, 47 ni están en CCB.
  const aFechar = todas.filter(t =>
    t.status === 'completed' && !t.completed_at && !t.ends_at
    && ccb.get(`${t.member_id}|${t.plan}`)?.due,
  ).map(t => ({ ...t, fecha: ccb.get(`${t.member_id}|${t.plan}`).due }))

  // --- C · los del cuatro --------------------------------------------------
  const aCorregir = [], aAgregar = []
  for (const [ext, plan] of Object.entries(ARREGLOS_DEL_4)) {
    if (plan.accion === 'dejar') continue
    const m = mid.get(ext)
    if (!m) throw new Error(`No resuelve el external_id ${ext} (${plan.quien})`)
    const suyas = (porLlave.get(`${m}|${plan.plan}`) || [])
    if (plan.accion === 'corregir') {
      const f = suyas.filter(x => x.status === 'reprobado')
      if (f.length !== 1) throw new Error(`${plan.quien}: esperaba 1 reprobado en ${plan.plan}, hay ${f.length}`)
      aCorregir.push({ ...f[0], fecha: plan.fecha, quien: plan.quien })
    } else {
      if (suyas.some(x => x.status === 'completed')) throw new Error(`${plan.quien} ya tiene ${plan.plan} aprobado`)
      aAgregar.push({ mid: m, plan: plan.plan, due: plan.fecha, nombre: plan.quien, ext })
    }
  }

  console.log(`\n=== LO QUE SE VA A HACER ===`)
  console.log(`A · cierres de CCB que faltan, se INSERTAN   ${aInsertar.length}  (${sinFechaAlInsertar} sin fecha, CCB tampoco la tiene)`)
  console.log(`B · fechas que faltan, se COMPLETAN          ${aFechar.length}`)
  console.log(`C · reprobado → completed (mismo intento)    ${aCorregir.length}  ${aCorregir.map(x => x.persona).join(', ')}`)
  console.log(`C · aprobación de otro intento, se AGREGA    ${aAgregar.length}  ${aAgregar.map(x => x.nombre).join(', ')}`)
  console.log(`C · se dejan como están, el sistema acierta  ${Object.values(ARREGLOS_DEL_4).filter(x => x.accion === 'dejar').length}`)

  const anosB = {}
  for (const f of aFechar) anosB[f.fecha.slice(0, 4)] = (anosB[f.fecha.slice(0, 4)] || 0) + 1
  console.log(`\nB, por año de la fecha que se les pone:`, JSON.stringify(Object.entries(anosB).sort()))

  // Respaldo ANTES de tocar: las filas que se modifican, completas.
  fs.writeFileSync(RESPALDO, JSON.stringify({
    generado: new Date().toISOString(),
    aFechar: aFechar.map(t => ({ id: t.id, member_id: t.member_id, plan: t.plan, persona: t.persona, completed_at: t.completed_at, enrolled_at: t.enrolled_at, fechaNueva: t.fecha })),
    aCorregir: aCorregir.map(t => ({ id: t.id, persona: t.persona, plan: t.plan, status: t.status, completed_at: t.completed_at, fechaNueva: t.fecha })),
    aInsertar, aAgregar,
  }, null, 2))
  console.log(`\nrespaldo en ${RESPALDO}`)

  const { rows: [antes] } = await c.query(
    `select count(*) n from study_enrollments where group_id is null and completed_at is null and status = 'completed'`)

  await c.query('begin')
  try {
    // A y C-agregar: la misma forma que las 22.331 históricas — sin grupo, con
    // el plan y la fecha. La nota es lo único que las distingue del import.
    const nuevas = [...aInsertar, ...aAgregar]
    for (const n of nuevas) {
      await c.query(`
        insert into study_enrollments (member_id, plan_id, status, completed_at, enrolled_at, notes)
        values ($1, $2, 'completed', $3::date, $3::date, $4)`,
      [n.mid, planId.get(n.plan), n.due, NOTA])
    }
    // B: solo la fecha. El estado ya dice `completed`; esto no cambia resultados.
    for (const f of aFechar) {
      await c.query(`
        update study_enrollments
           set completed_at = $2::date,
               enrolled_at = coalesce(enrolled_at, $2::date)
         where id = $1 and completed_at is null`, [f.id, f.fecha])
    }
    for (const t of aCorregir) {
      await c.query(`
        update study_enrollments
           set status = 'completed', completed_at = $2::date, notes = $3
         where id = $1 and status = 'reprobado'`, [t.id, t.fecha, NOTA])
    }

    const { rows: [v] } = await c.query(
      `select count(*) filter (where notes = $1) nuevas_o_tocadas from study_enrollments`, [NOTA])
    const { rows: [v2] } = await c.query(
      `select count(*) n from study_enrollments where group_id is null and completed_at is null and status = 'completed'`)
    console.log(`\nverificación dentro de la transacción:`)
    console.log(`  filas con la nota de DAT-14              ${v.nuevas_o_tocadas}  (esperado ${nuevas.length + aCorregir.length})`)
    console.log(`  'completed' sin grupo y sin fecha  ${antes.n} → ${v2.n}  (esperado +${sinFechaAlInsertar})`)

    if (APLICAR) { await c.query('commit'); console.log(`\n✅ APLICADO`) }
    else { await c.query('rollback'); console.log(`\n↩️  DRY RUN — rollback, no se guardó nada. Correr con --aplicar.`) }
  } catch (e) {
    await c.query('rollback'); console.error('\n❌ rollback por error:', e.message); process.exitCode = 1
  }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

/**
 * Estudios de Sofía Castro y José Cedeño que no bajaron de CCB.
 *
 *   dry-run:  node scripts/estudios-ccb-2026-10/sofia-y-jose.cjs
 *   aplicar:  ... --aplicar
 *
 * LOS CINCO que trajo Floriana el 2026-10-09, idénticos para los dos (son
 * pareja: external_id 21177 y 21178, consecutivos).
 *
 * SE REGISTRAN SIN GRUPO, que es la forma NORMAL del histórico y no un
 * atajo: 22.347 de las 37.183 matrículas del sistema no tienen grupo. Queda
 * el nivel, la fecha y que está completado. De los 18 grupos de Nivel 3 que
 * cerraron cerca del 16 de agosto no hay forma de saber cuál fue, y meterlos
 * en el de un dirigente al azar le ensuciaría la lista de estudiantes a
 * alguien que nunca los tuvo.
 *
 * DOS LINEAS SE CONSULTARON ANTES DE ESCRIBIR, porque chocaban con lo que ya
 * había, y Floriana resolvió las dos (2026-10-09):
 *   · «N2 · 1 jul 2025» cae el MISMO día en que empezaron Transformados.
 *     Decidido: son estudios distintos, el Nivel 2 se agrega.
 *   · Ya tienen un N2 completado con Paola Goiri (feb–abr 2026) que no está
 *     en la lista de CCB. Decidido: repitieron, el de mayo se agrega.
 *     (Repetir nivel es común: 54 personas repiten N2 en el sistema.)
 *
 * LA FECHA VA AL MEDIODÍA DE COSTA RICA y no a medianoche: `completed_at` es
 * timestamptz, y una medianoche local se lee como el día anterior en UTC. Es
 * el mismo corrimiento que ya mordió cuatro veces en este repo.
 *
 * IDEMPOTENTE: no agrega una matrícula que ya exista con el mismo plan y la
 * misma fecha.
 */
const fs = require('fs')
const path = require('path')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const PERSONAS = {
  'Sofia Castro Morales': 'ff9d4ac4-06d6-4fce-b425-00ccc1086e8b',
  'Jose Cedeño Pares': '6424d643-653a-4073-9e27-c374b36185d8',
}

/** [código del plan, fecha de finalización] — tal cual los pasó Floriana. */
const ESTUDIOS = [
  ['N1', '2025-02-25'],
  ['N1', '2026-02-20'],
  ['N2', '2025-07-01'],
  ['N2', '2026-05-23'],
  ['N3', '2026-08-16'],
]

const APLICAR = process.argv.includes('--aplicar')
const alMediodiaCR = (ymd) => `${ymd}T12:00:00-06:00`

;(async () => {
  const c = nuevoCliente()
  await c.connect()

  const planes = new Map(
    (await c.query('select id, code from study_plans where code = any($1)',
      [[...new Set(ESTUDIOS.map(e => e[0]))]])).rows.map(r => [r.code, r.id]))
  for (const [code] of ESTUDIOS) {
    if (!planes.has(code)) throw new Error(`No existe el plan ${code}`)
  }

  const aInsertar = []
  for (const [nombre, memberId] of Object.entries(PERSONAS)) {
    console.log(`\n=== ${nombre}`)
    for (const [code, fecha] of ESTUDIOS) {
      const planId = planes.get(code)
      // Idempotencia: misma persona, mismo plan, misma fecha.
      const { rows } = await c.query(
        `select e.id from study_enrollments e
         where e.member_id = $1 and e.plan_id = $2
           and e.completed_at::date = $3::date`,
        [memberId, planId, fecha])
      if (rows.length) { console.log(`  = ${code} · ${fecha}  (ya estaba)`); continue }
      console.log(`  + ${code} · ${fecha}`)
      aInsertar.push({ nombre, memberId, planId, code, fecha })
    }
  }

  console.log(`\na insertar: ${aInsertar.length}`)
  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); await c.end(); return }
  if (!aInsertar.length) { console.log('Nada que hacer.'); await c.end(); return }

  const creados = []
  for (const x of aInsertar) {
    const { rows } = await c.query(
      `insert into study_enrollments (member_id, plan_id, status, completed_at, es_externo)
       values ($1, $2, 'completed', $3, false) returning id`,
      [x.memberId, x.planId, alMediodiaCR(x.fecha)])
    creados.push({ id: rows[0].id, ...x })
  }
  const respaldo = path.join(__dirname, `rollback-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  fs.writeFileSync(respaldo, JSON.stringify(creados, null, 2))
  console.log(`\ninsertadas: ${creados.length}\nrespaldo: ${respaldo}`)

  for (const [nombre, memberId] of Object.entries(PERSONAS)) {
    console.log(`\n=== ${nombre} — queda así:`)
    console.table((await c.query(
      `select coalesce(p.code, p2.code) as nivel, e.status,
              coalesce(e.completed_at at time zone 'America/Costa_Rica', g.ends_at::timestamp)::date::text as fecha,
              coalesce(g.name, '(sin grupo)') as grupo
       from study_enrollments e
       left join study_plans p on p.id = e.plan_id
       left join study_groups g on g.id = e.group_id
       left join study_plans p2 on p2.id = g.plan_id
       where e.member_id = $1
       order by 3`, [memberId])).rows)
  }
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

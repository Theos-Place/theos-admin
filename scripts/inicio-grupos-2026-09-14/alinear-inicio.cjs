/**
 * Alinear la fecha de inicio con el día en que el grupo realmente se reúne.
 *   node scripts/inicio-grupos-2026-09-14/alinear-inicio.cjs [--aplicar]
 *
 * Al abrir el cuatrimestre a varios grupos les quedó el lunes 28 de setiembre
 * por default, que es cuando arranca la semana de inicio. Pero un grupo que se
 * reúne los martes no empieza el lunes: empieza el 29.
 *
 * Se tocan SOLO los que tienen exactamente el default (2026-09-28) y cuyo día
 * programado no es lunes. Los que ya cuadran y los de octubre —que se ajustaron
 * a mano— no se miran.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const DEFAULT = '2026-09-28'          // lunes de la semana de inicio
const DOW = ['D','L','M','X','J','V','S']
const OFFSET = { L:0, M:1, X:2, J:3, V:4, S:5, D:6 }   // días desde el lunes 28

const fechaPara = dia => {
  const d = new Date(Date.UTC(2026, 8, 28) + OFFSET[dia] * 86400000)
  return d.toISOString().slice(0, 10)
}

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query(`select g.id, g.name, to_char(g.starts_at,'YYYY-MM-DD') inicio,
      to_char(g.ends_at,'YYYY-MM-DD') fin, g.schedule_days, g.schedule_time, p.name plan
    from study_groups g left join study_plans p on p.id=g.plan_id
    where g.status='en_matricula' and g.starts_at = date '${DEFAULT}' order by g.name`)

  const cambios = []
  for (const g of rows) {
    const dias = (g.schedule_days || []).filter(d => OFFSET[d] !== undefined)
    if (!dias.length) continue                       // sin día programado: no se adivina
    // El primero de la semana, por si el grupo se reúne más de un día.
    const primero = dias.sort((a, b) => OFFSET[a] - OFFSET[b])[0]
    if (primero === 'L') continue                    // ya cuadra
    cambios.push({ ...g, dia: primero, nuevo: fechaPara(primero) })
  }

  console.log(`grupos con el default ${DEFAULT}: ${rows.length}`)
  console.log(`de esos, con día programado distinto al lunes: ${cambios.length}\n`)
  console.table(cambios.map(x => ({
    grupo: x.name, plan: x.plan, dia: x.dia, hora: x.schedule_time,
    antes: x.inicio, despues: x.nuevo, tiene_fin: x.fin ?? '—',
  })))

  await c.query('begin')
  let n = 0
  for (const x of cambios) {
    const { rowCount } = await c.query(
      `update study_groups set starts_at=$2, updated_at=now()
       where id=$1 and status='en_matricula' and starts_at=date '${DEFAULT}'`, [x.id, x.nuevo])
    n += rowCount
  }
  console.log(`\nactualizados: ${n}`)
  const { rows: despues } = await c.query(`select to_char(starts_at,'YYYY-MM-DD') inicio,
      count(*)::int n, count(*) filter (where not (schedule_days @> array[substr('DLMXJVS', extract(dow from starts_at)::int+1, 1)]))::int desalineados
    from study_groups where status='en_matricula' group by 1 order by 1`)
  console.table(despues)
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback) — no se tocó nada.') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

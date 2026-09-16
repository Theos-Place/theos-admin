/** SOLO LECTURA: estado final de los cinco casos tocados hoy. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const CASOS = [
  ['Gisselle López Rodríguez', '15389eb8-2398-4fbc-9468-ac1ca9a5386b'],
  ['Paula García Apú',         '736684e1-7c94-4ff4-a3bf-7a7f22e31e2e'],
  ['Daniel Alfaro Cardoza',    '0d1099b2-c6c5-44fc-8465-b6d0ccda8fcd'],
  ['Alberto Vargas Carpio',    null],
  ['Yanil Gutiérrez Ríos',     null],
  ['María José Ruiz Fuentes',  '2c04a86e-0166-4156-8b3b-d9477ab257c3'],
]
;(async () => {
  const c = nuevoCliente(); await c.connect()
  for (let [nombre, id] of CASOS) {
    if (!id) {
      const f = await c.query(`select id from members where unaccent(lower(first_name||' '||last_name)) like $1`,
        ['%'+nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(' ').join('%')+'%'])
      id = f.rows[0]?.id
    }
    const e = await c.query(`
      select e.status, g.name as grupo, e.dropped_at, e.drop_reason
      from study_enrollments e join study_groups g on g.id=e.group_id
      where e.member_id=$1 and e.created_at > now() - interval '3 months'
        and e.status not in ('completed') order by e.created_at desc limit 2`, [id])
    const p = await c.query(`
      select amount, status, concept, review_status from payments where member_id=$1 order by created_at`, [id])
    console.log(`\n${nombre}`)
    e.rows.forEach(x => console.log(`   matrícula: ${x.status} · ${x.grupo}${x.dropped_at ? ' · RASTRO DE BAJA: '+x.drop_reason : ''}`))
    console.log(`   pagos (${p.rowCount}): ` + (p.rows.map(x=>`₡${Number(x.amount)} ${x.status}/${x.review_status ?? '—'} [${x.concept}]`).join('  ·  ') || 'ninguno'))
  }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

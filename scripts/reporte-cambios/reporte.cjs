/** SOLO LECTURA: estado final de las 11 personas tocadas hoy + lo que sigue pendiente. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const TOCADAS = [
  ['María José Ruiz Fuentes',   '2c04a86e-0166-4156-8b3b-d9477ab257c3'],
  ['Gisselle López Rodríguez',  '15389eb8-2398-4fbc-9468-ac1ca9a5386b'],
  ['Paula García Apú',          '736684e1-7c94-4ff4-a3bf-7a7f22e31e2e'],
  ['Daniel Alfaro Cardoza',     '0d1099b2-c6c5-44fc-8465-b6d0ccda8fcd'],
  ['Alberto Vargas Carpio',     null],
  ['Yanil Gutiérrez Ríos',      null],
  ['Jonathan Valverde Cordoba', '2a156c86-a028-451c-b50a-2fc720a289cb'],
  ['Victoria Delgado Chaves',   '0552f084-3f0d-4b51-812b-f96305676ebb'],
  ['Ileana Salazar Rodriguez',  null],
  ['Freima Chavarria Casasola', null],
  ['Catalina Arce Viquez',      null],
  ['Wendel Arias',              null],
  ['Mariana Arguedas Vargas',   null],
  ['Raquel Otalora Flores',     null],
]
const buscar = async (c, nombre) => {
  const like = '%' + nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(' ').join('%') + '%'
  const r = await c.query(`select id from members where unaccent(lower(first_name||' '||last_name)) like $1 and is_active order by length(first_name||last_name) limit 1`, [like])
  return r.rows[0]?.id
}
;(async () => {
  const c = nuevoCliente(); await c.connect()
  console.log('══════ PERSONAS TOCADAS HOY ══════\n')
  let alerta = 0
  for (let [nombre, id] of TOCADAS) {
    id = id ?? await buscar(c, nombre)
    if (!id) { console.log(`  ${nombre}: NO ENCONTRADA`); continue }
    const p = await c.query(`
      select pa.amount, pa.status, pa.concept, pa.review_status, pa.payment_method, g.name as grupo
      from payments pa left join study_groups g on g.id=pa.study_group_id
      where pa.member_id=$1 and pa.status in ('pending','paid') order by pa.created_at`, [id])
    const e = await c.query(`
      select e.status, g.name as grupo from study_enrollments e join study_groups g on g.id=e.group_id
      where e.member_id=$1 and e.created_at > now() - interval '2 months' and e.status <> 'completed'
      order by e.created_at desc limit 1`, [id])
    const pend = p.rows.filter(x => x.status === 'pending')
    if (pend.length) alerta++
    console.log(`${pend.length ? '⚠ ' : '✓ '}${nombre}`)
    console.log(`    matrícula: ${e.rows[0] ? e.rows[0].status + ' · ' + e.rows[0].grupo : '—'}`)
    console.log(`    pagos:     ${p.rows.map(x=>`₡${Number(x.amount)} ${x.status}${x.review_status?'/'+x.review_status:''} [${x.concept}, ${x.payment_method}]`).join('  ·  ') || 'ninguno'}`)
  }
  console.log(`\nCon algo pendiente: ${alerta}\n`)

  console.log('══════ BARRIDOS DE CONTROL ══════')
  const q = async (t, sql) => { const r = await c.query(sql); console.log(`  ${t}: ${r.rows[0].n}`) }
  await q('matrículas con más de un cobro vivo', `select count(*) n from (select p.enrollment_id from payments p where p.concept='matricula' and p.status in ('paid','pending') group by 1 having count(*)>1) x`)
  await q("matrículas en 'pendiente_de_pago' con un pago ya aprobado", `select count(*) n from study_enrollments e where e.status='pendiente_de_pago' and exists (select 1 from payments p where p.enrollment_id=e.id and p.concept='matricula' and p.status='paid')`)
  await q('cobros de matrícula sin grupo asignado', `select count(*) n from payments where concept='matricula' and study_group_id is null`)
  await q('becas activas duplicadas (misma persona y plan)', `select count(*) n from (select member_id, plan_id from scholarships where status='active' and kind='asignada' group by 1,2 having count(*)>1) x`)
  await q('becas canceladas sin motivo', `select count(*) n from scholarships where status='revoked' and revoke_reason is null`)

  console.log('\n══════ LO QUE QUEDA ABIERTO ══════')
  const h = await c.query(`select m.first_name||' '||m.last_name as p, pa.amount, pa.status from payments pa join members m on m.id=pa.member_id where pa.concept='matricula' and pa.study_group_id is null`)
  h.rows.forEach(x => console.log(`  cobro sin grupo: ${x.p} · ₡${Number(x.amount)} ${x.status}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

/** SOLO LECTURA: los cobros de las matrículas del N3, buscados por enrollment_id. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const N3 = 'ca5ea95b-ac49-46ec-a631-f2d1632d6cae'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select m.first_name||' '||m.last_name as persona, e.id as enr, e.status as matricula,
           pa.id as pago, pa.amount, pa.status, pa.concept, pa.review_status,
           pa.study_group_id, pa.entity_type, pa.description, pa.payment_method,
           pa.receipt_path is not null as recibo, pa.created_at
    from study_enrollments e
      join members m on m.id=e.member_id
      left join payments pa on pa.enrollment_id = e.id
    where e.group_id=$1 order by m.first_name`,[N3])
  r.rows.forEach(x => console.log(`${x.persona.padEnd(30)} matrícula=${String(x.matricula).padEnd(10)} ` +
    (x.pago ? `pago ₡${Number(x.amount)} ${x.status}/${x.review_status ?? '—'} gid=${x.study_group_id ? 'sí':'NULL'} etype=${x.entity_type ?? 'NULL'} desc=${JSON.stringify(x.description)}` : 'SIN PAGO')))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

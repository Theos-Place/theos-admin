/** SOLO LECTURA: cobros de "Diferencia por cambio de grupo" mal calculados por la beca. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select d.id, m.first_name||' '||m.last_name as persona, d.amount as diferencia, d.status,
           d.created_at, g.name as grupo_destino, pl.cost as costo_destino,
           -- el pago que viajó con la matrícula
           v.id as pago_viajero, v.amount as monto_viajero, v.status as estado_viajero,
           v.scholarship_id, s.discount_value, s.original_amount, s.final_amount
    from payments d
      join members m on m.id = d.member_id
      left join study_groups g on g.id = d.study_group_id
      left join study_plans pl on pl.id = g.plan_id
      left join payments v on v.enrollment_id = d.enrollment_id and v.id <> d.id and v.status='paid'
      left join scholarships s on s.id = v.scholarship_id
    where d.description like 'Diferencia por cambio de grupo%'
    order by d.created_at desc`)
  console.log(`cobros de diferencia: ${r.rowCount}\n`)
  r.rows.forEach(x => {
    const cubierto = Number(x.monto_viajero ?? 0) + (x.original_amount ? Number(x.original_amount) - Number(x.final_amount) : 0)
    const deberia = Math.max(0, Number(x.costo_destino ?? 0) - cubierto)
    const mal = x.scholarship_id && Number(x.diferencia) !== deberia
    console.log(`${mal ? '>>> MAL CALCULADO' : '    ok           '} ${x.persona} · ${x.grupo_destino}`)
    console.log(`      cobrado ₡${Number(x.diferencia)} · estado ${x.status} · destino cuesta ₡${Number(x.costo_destino ?? 0)}`)
    console.log(`      pago que viajó: ₡${Number(x.monto_viajero ?? 0)}${x.scholarship_id ? ` (beca ${x.discount_value}%, cubrió ₡${Number(x.original_amount) - Number(x.final_amount)})` : ' (sin beca)'}`)
    console.log(`      debería cobrarse: ₡${deberia}\n`)
  })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

/** SOLO LECTURA: ¿quién más tiene dos cobros de matrícula vivos en la misma matrícula? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select e.id as enr, m.first_name||' '||m.last_name as persona, g.name as grupo, e.status as estado_matricula,
           count(*) filter (where p.status='paid')    as pagados,
           count(*) filter (where p.status='pending') as pendientes,
           sum(p.amount) filter (where p.status='pending') as monto_pendiente,
           min(p.created_at) as primer_cobro, max(p.created_at) as ultimo_cobro
    from payments p
      join study_enrollments e on e.id = p.enrollment_id
      join members m on m.id = p.member_id
      left join study_groups g on g.id = e.group_id
    where p.concept='matricula' and p.status in ('paid','pending')
    group by e.id, m.first_name, m.last_name, g.name, e.status
    having count(*) > 1
    order by max(p.created_at) desc`)
  console.log(`matrículas con más de un cobro vivo: ${r.rowCount}\n`)
  r.rows.forEach(x => {
    const grave = Number(x.pagados) > 0 && Number(x.pendientes) > 0
    console.log(`${grave ? '>>> PAGÓ Y LE QUEDA UN COBRO' : '    '} ${x.persona} · ${x.grupo}`)
    console.log(`      matrícula: ${x.estado_matricula} · pagados: ${x.pagados} · pendientes: ${x.pendientes} (₡${Number(x.monto_pendiente ?? 0)})`)
    console.log(`      del ${x.primer_cobro.toISOString()} al ${x.ultimo_cobro.toISOString()}\n`)
  })

  // Y el otro síntoma: matrícula pagada pero en pendiente_de_pago.
  const s = await c.query(`
    select m.first_name||' '||m.last_name as persona, g.name as grupo, e.status, e.created_at
    from study_enrollments e
      join members m on m.id=e.member_id left join study_groups g on g.id=e.group_id
    where e.status='pendiente_de_pago'
      and exists (select 1 from payments p where p.enrollment_id=e.id and p.concept='matricula' and p.status='paid')`)
  console.log(`=== matrículas en 'pendiente_de_pago' que YA tienen un pago aprobado: ${s.rowCount} ===`)
  s.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

/** SOLO LECTURA: ¿a quién más botó el cron antes de tiempo por el created_at reusado? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  // Matrículas dadas de baja por el barrido, con su reloj REAL (el cobro).
  const r = await c.query(`
    with bajas as (
      select e.id, e.member_id, e.group_id, e.created_at, e.dropped_at, e.status
      from study_enrollments e
      where e.drop_reason like 'Matrícula sin comprobante por más de%'
    )
    select b.id, m.first_name||' '||m.last_name as persona, g.name as grupo,
           b.created_at as fila_creada, b.dropped_at, b.status,
           (select max(p.created_at) from payments p
             where p.enrollment_id = b.id and p.concept='matricula') as ultimo_cobro,
           round(extract(epoch from (b.dropped_at - (select max(p.created_at) from payments p
             where p.enrollment_id = b.id and p.concept='matricula')))/3600, 1) as horas_reales
    from bajas b join members m on m.id=b.member_id left join study_groups g on g.id=b.group_id
    order by b.dropped_at desc`)
  console.log(`bajas por el barrido: ${r.rowCount}`)
  r.rows.forEach(x => {
    const mal = x.horas_reales !== null && Number(x.horas_reales) < 24
    console.log(`${mal ? '>>> PREMATURA' : '    ok      '} ${x.persona} · ${x.grupo} · horas reales desde el cobro: ${x.horas_reales} · baja ${x.dropped_at.toISOString()}`)
  })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

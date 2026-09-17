/** SOLO LECTURA: a quién afecta pasar la gracia de 24h a 72h. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select m.first_name||' '||m.last_name p, g.name grupo,
           round(extract(epoch from (now() - pa.created_at))/3600, 1) horas,
           pa.review_status, pa.amount
    from study_enrollments e
      join members m on m.id=e.member_id
      left join study_groups g on g.id=e.group_id
      left join payments pa on pa.enrollment_id=e.id and pa.concept='matricula' and pa.status='pending'
    where e.status='pendiente_de_pago'
    order by 3 desc nulls last`)
  console.log(`=== matrículas en 'pendiente_de_pago' ahora (${r.rowCount}) ===`)
  r.rows.forEach(x => {
    const h = Number(x.horas ?? 0)
    const con24 = h >= 24 && !x.review_status
    const con72 = h >= 72 && !x.review_status
    console.log(`  ${x.p.padEnd(28)} ${String(x.grupo ?? '—').slice(0,26).padEnd(28)} ${String(x.horas ?? '—').padStart(6)}h  ` +
      `${x.review_status ? 'comprobante: '+x.review_status : 'sin comprobante'}  ` +
      `${con24 ? '· hoy la botaría' : ''}${con72 ? ' · y con 72h también' : con24 ? ' · con 72h se salva' : ''}`)
  })
  const n = await c.query(`
    select count(*) filter (where h >= 24) c24, count(*) filter (where h >= 72) c72
    from (select round(extract(epoch from (now() - pa.created_at))/3600,1) h
          from study_enrollments e join payments pa on pa.enrollment_id=e.id
          where e.status='pendiente_de_pago' and pa.concept='matricula' and pa.status='pending'
            and pa.review_status is null) x`)
  console.log(`\ncon la regla de HOY (24h) el cron botaría: ${n.rows[0].c24}`)
  console.log(`con 72h botaría:                          ${n.rows[0].c72}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

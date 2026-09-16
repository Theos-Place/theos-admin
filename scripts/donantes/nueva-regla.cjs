/** SOLO LECTURA: efecto de la nueva definición de donante activo. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const d = await c.query(`select donation_date::date f, count(*) n, count(distinct member_id) p
    from donations group by 1 order by 1 desc limit 8`)
  console.log('=== fechas de donación (últimas 8) ===')
  d.rows.forEach(x => console.log(`  ${x.f.toISOString().slice(0,10)}  ${String(x.n).padStart(5)} filas · ${String(x.p).padStart(5)} personas`))

  const v = await c.query(`select
    (date_trunc('quarter', current_date) - interval '6 months')::date as ventana_vieja,
    (date_trunc('month',   current_date) - interval '5 months')::date as ventana_nueva,
    (select count(*) from members where is_donor) as marcados_hoy,
    (select count(distinct member_id) from donations
      where donation_date >= (date_trunc('month', current_date) - interval '5 months')::date) as con_la_nueva`)
  const r = v.rows[0]
  console.log('\n=== LA VENTANA ===')
  console.log(`  regla vieja: desde ${r.ventana_vieja.toISOString().slice(0,10)} (inicio del trimestre de hace 2 trimestres)`)
  console.log(`  regla nueva: desde ${r.ventana_nueva.toISOString().slice(0,10)} (mes actual + los 5 anteriores)`)
  console.log(`\n  donantes marcados hoy:  ${r.marcados_hoy}`)
  console.log(`  donantes con la nueva:  ${r.con_la_nueva}   (${r.con_la_nueva - r.marcados_hoy})`)

  const p = await c.query(`select m.first_name||' '||m.last_name as n, max(d.donation_date)::date ultima
    from members m join donations d on d.member_id=m.id
    where m.is_donor group by m.id, m.first_name, m.last_name
    having max(d.donation_date) < (date_trunc('month', current_date) - interval '5 months')::date
    order by 2 desc limit 5`)
  console.log(`\n=== ejemplos de los que PIERDEN la etiqueta (${p.rowCount} de muestra) ===`)
  p.rows.forEach(x => console.log(`  ${x.n.padEnd(34)} última donación ${x.ultima.toISOString().slice(0,10)}`))

  console.log('\n=== cómo se movería mes a mes con la nueva regla ===')
  const s = await c.query(`
    select to_char(mes,'YYYY-MM') m,
      (select count(distinct d.member_id) from donations d
        where d.donation_date >= (date_trunc('month', mes) - interval '5 months')::date
          and d.donation_date <= (date_trunc('month', mes) + interval '1 month - 1 day')::date) n
    from generate_series('2026-06-01'::date, '2027-02-01'::date, '1 month') mes`)
  s.rows.forEach(x => console.log(`  ${x.m}: ${x.n} donantes activos`))
  await c.end()
})().catch(e => { console.error('ERROR:', e); process.exit(1) })

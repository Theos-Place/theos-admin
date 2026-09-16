const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  console.log('=== donaciones por mes (últimos 15) ===')
  const m = await c.query(`select to_char(date_trunc('month', donation_date),'YYYY-MM') mes, count(*) n,
    count(distinct member_id) personas from donations where donation_date >= current_date - interval '15 months'
    group by 1 order by 1`)
  m.rows.forEach(x => console.log(`  ${x.mes}  ${String(x.n).padStart(5)} donaciones · ${String(x.personas).padStart(4)} personas`))

  console.log('\n=== qué pasa el 1 de octubre, cuando la ventana se recorta ===')
  const o = await c.query(`
    select
      (select count(distinct member_id) from donations
        where donation_date >= (date_trunc('quarter', current_date) - interval '6 months')::date) as hoy,
      (select count(distinct member_id) from donations
        where donation_date >= (date_trunc('quarter', current_date + interval '1 month') - interval '6 months')::date) as desde_octubre`)
  const { hoy, desde_octubre } = o.rows[0]
  console.log(`  donantes hoy:            ${hoy}`)
  console.log(`  donantes el 1 de octubre: ${desde_octubre}   (pierden la etiqueta ${hoy - desde_octubre} personas de un solo golpe)`)

  console.log('\n=== el largo de la ventana a lo largo del año ===')
  const v = await c.query(`
    select to_char(d,'YYYY-MM-DD') dia,
           (d::date - (date_trunc('quarter', d) - interval '6 months')::date) dias
    from generate_series('2026-07-01'::date, '2027-03-01'::date, '1 month') d`)
  v.rows.forEach(x => console.log(`  ${x.dia}: ventana de ${x.dias} días (${(x.dias/30.4).toFixed(1)} meses)`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

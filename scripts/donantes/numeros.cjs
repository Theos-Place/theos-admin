/** SOLO LECTURA: qué significa hoy "donante", en números. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const v = await c.query(`select
    current_date as hoy,
    date_trunc('quarter', current_date)::date as trimestre_actual,
    (date_trunc('quarter', current_date) - interval '6 months')::date as ventana_desde,
    (current_date - (date_trunc('quarter', current_date) - interval '6 months')::date) as dias_de_ventana`)
  console.log('=== LA VENTANA ==='); console.log('  ' + JSON.stringify(v.rows[0]))

  const q = async (t, sql, p=[]) => { const r = await c.query(sql,p); console.log(`  ${t.padEnd(58)} ${r.rows[0].n}`) }
  console.log('\n=== CONTEOS ===')
  await q('miembros con is_donor = true', `select count(*) n from members where is_donor`)
  await q('miembros con is_donor = true Y activos', `select count(*) n from members where is_donor and is_active`)
  await q('donaciones en total', `select count(*) n from donations`)
  await q('donaciones con member_id (identificadas a una ficha)', `select count(*) n from donations where member_id is not null`)
  await q('donaciones SIN member_id (nunca cuentan)', `select count(*) n from donations where member_id is null`)
  await q('personas distintas que han donado alguna vez', `select count(distinct member_id) n from donations where member_id is not null`)
  await q('personas que donaron dentro de la ventana', `select count(distinct member_id) n from donations where member_id is not null and donation_date >= (date_trunc('quarter', current_date) - interval '6 months')::date`)

  console.log('\n=== ¿is_donor coincide con la ventana? ===')
  await q('marcados donante pero SIN donación en la ventana', `select count(*) n from members m where m.is_donor and not exists (select 1 from donations d where d.member_id=m.id and d.donation_date >= (date_trunc('quarter', current_date) - interval '6 months')::date)`)
  await q('donaron en la ventana pero NO están marcados', `select count(*) n from (select distinct d.member_id from donations d join members m on m.id=d.member_id where d.donation_date >= (date_trunc('quarter', current_date) - interval '6 months')::date and not m.is_donor) x`)

  console.log('\n=== is_identified vs member_id (posible desacuerdo) ===')
  await q("donaciones con member_id pero is_identified = false", `select count(*) n from donations where member_id is not null and is_identified is not true`)
  await q("donaciones is_identified = true pero sin member_id", `select count(*) n from donations where is_identified and member_id is null`)

  console.log('\n=== si la ventana fuera 6 meses exactos (rodante) ===')
  await q('personas que donaron en los últimos 6 meses exactos', `select count(distinct member_id) n from donations where member_id is not null and donation_date >= current_date - interval '6 months'`)

  const r = await c.query(`select min(donation_date) desde, max(donation_date) hasta from donations`)
  console.log(`\nrango de fechas de donaciones: ${r.rows[0].desde} → ${r.rows[0].hasta}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

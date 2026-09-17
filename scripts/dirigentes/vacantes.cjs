/** SOLO LECTURA: ¿existen vacantes o aplicaciones para puestos de dirigente? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const q = async (t, sql) => { const r = await c.query(sql); console.log(`  ${t.padEnd(64)} ${r.rows[0].n}`) }
  const PUESTOS = `
    select sp.id from service_positions sp join areas ar on ar.id=sp.area_id
    where ar.name='Comité Dirigentes' and unaccent(lower(sp.title)) like 'dirigente%'`
  console.log('=== puestos de dirigente ===')
  await q('vacantes creadas alguna vez para esos puestos', `select count(*) n from vacancies where position_id in (${PUESTOS})`)
  await q('aplicaciones a esas vacantes', `select count(*) n from applications a join vacancies v on v.id=a.vacancy_id where v.position_id in (${PUESTOS})`)
  console.log('\n=== para comparar, todo el comité (incluye Encargado/Colaborador) ===')
  const TODOS = `select sp.id from service_positions sp join areas ar on ar.id=sp.area_id where ar.name='Comité Dirigentes'`
  await q('vacantes del comité entero', `select count(*) n from vacancies where position_id in (${TODOS})`)
  await q('aplicaciones del comité entero', `select count(*) n from applications a join vacancies v on v.id=a.vacancy_id where v.position_id in (${TODOS})`)
  console.log('\n=== y en toda la organización, para dimensionar ===')
  await q('vacantes en total', `select count(*) n from vacancies`)
  await q('aplicaciones en total', `select count(*) n from applications`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

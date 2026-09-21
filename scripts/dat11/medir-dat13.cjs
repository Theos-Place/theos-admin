/** SOLO LECTURA · DAT-13: las dos cuentas sueltas que salieron de DAT-11. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()

  console.log('=== Manuel Flores · TODAS las fichas con ese nombre ===')
  console.table((await c.query(`
    select m.id, m.first_name||' '||m.last_name nombre, m.cedula, m.email, m.phone,
           m.birth_date::date nacio, m.is_active, m.deactivation_reason,
           m.external_id, m.auth_user_id, m.created_at::date creada,
           (select count(*) from event_checkins x where x.member_id=m.id) checkins,
           (select count(*) from study_enrollments x where x.member_id=m.id) matriculas,
           (select count(*) from payments x where x.member_id=m.id) pagos
    from members m
    where m.first_name ilike '%manuel%' and m.last_name ilike '%flores%'
    order by m.created_at`)).rows)

  console.log('\n=== La cuenta mflores1909 ===')
  console.table((await c.query(`
    select u.id, u.email, u.created_at::date creada, u.last_sign_in_at::date ultimo,
           u.banned_until
    from auth.users u where u.email = 'mflores1909@gmail.com'`)).rows)

  console.log('\n=== Sebastián Garro · ficha y cuenta ===')
  console.table((await c.query(`
    select m.id, m.first_name||' '||m.last_name nombre, m.cedula, m.email,
           m.is_active, m.auth_user_id,
           (select count(*) from event_checkins x where x.member_id=m.id) checkins
    from members m where lower(m.email) = 'sebasgaes@hotmail.com'
       or (m.first_name ilike '%sebast%' and m.last_name ilike '%garro%')`)).rows)
  console.table((await c.query(`
    select u.id, u.email, u.created_at::date creada, u.last_sign_in_at::date ultimo,
           (select count(*) from members m where m.auth_user_id = u.id) fichas_vinculadas
    from auth.users u where u.email = 'sebasgaes@hotmail.com'`)).rows)

  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

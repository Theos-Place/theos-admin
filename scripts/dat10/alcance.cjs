/** SOLO LECTURA · DAT-10 etapa 1, punto 4: cuántos casos más hay del mismo patrón. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()

  console.log('=== La cuenta de Tatiana: a qué ficha apunta ===')
  console.table((await c.query(`
    select m.id, m.first_name||' '||m.last_name nombre, m.cedula, m.email, m.auth_user_id
    from members m where m.auth_user_id = 'c3449730-98cb-4e3d-99e4-5aefd2023b31'`)).rows)

  console.log('\n=== A · Correos en MÁS DE UNA ficha activa ===')
  const dup = await c.query(`
    select lower(m.email) correo, count(*) fichas,
           string_agg(m.first_name||' '||m.last_name || coalesce(' ('||m.cedula||')',''), ' | ') personas
    from members m
    where m.email is not null and m.is_active
      and m.first_name not ilike '%[prueba]%'
    group by 1 having count(*) > 1
    order by 2 desc, 1`)
  console.log(`correos repetidos en fichas activas: ${dup.rowCount}`)
  console.table(dup.rows.slice(0, 15))

  console.log('\n=== B · Cuentas cuyo correo vive en OTRA ficha (el caso Tatiana) ===')
  const desalineadas = await c.query(`
    select u.email,
           mv.first_name||' '||mv.last_name AS ficha_vinculada,
           mv.cedula ced_vinculada,
           me.first_name||' '||me.last_name AS ficha_del_correo,
           me.cedula ced_correo,
           u.last_sign_in_at::date ultimo_ingreso
    from auth.users u
    join members mv on mv.auth_user_id = u.id
    join members me on lower(me.email) = lower(u.email) and me.is_active
    where mv.id <> me.id
    order by u.last_sign_in_at desc nulls last`)
  console.log(`cuentas donde el correo apunta a una ficha distinta: ${desalineadas.rowCount}`)
  console.table(desalineadas.rows.slice(0, 20))

  console.log('\n=== C · Cuentas SIN ficha vinculada cuyo correo sí está en una ficha ===')
  const sinVinculo = await c.query(`
    select u.email, me.first_name||' '||me.last_name persona, u.last_sign_in_at::date ultimo
    from auth.users u
    join members me on lower(me.email) = lower(u.email) and me.is_active
    where not exists (select 1 from members m2 where m2.auth_user_id = u.id)
      and u.last_sign_in_at is not null
    order by u.last_sign_in_at desc limit 10`)
  console.log(`cuentas que entraron y no tienen ficha vinculada: ${sinVinculo.rowCount}`)
  console.table(sinVinculo.rows)

  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

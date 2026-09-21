/** SOLO LECTURA · DAT-10 etapa 1: el caso Tatiana y cuántos más hay igual. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const CORREO = 'tati_brenes02@hotmail.com'
;(async () => {
  const c = nuevoCliente(); await c.connect()

  console.log('=== 1. ¿En cuántas fichas está ese correo? ===')
  console.table((await c.query(`
    select id, first_name||' '||last_name nombre, cedula, email, is_active, deactivation_reason,
           birth_date, created_at::date
    from members where lower(email) = lower($1)`, [CORREO])).rows)

  console.log('=== 2. Las dos personas por cédula ===')
  console.table((await c.query(`
    select id, first_name||' '||last_name nombre, cedula, email, is_active, birth_date
    from members where replace(cedula,'-','') in ('402040583','401061311')
       or cedula in ('4-0204-0583','4-0106-1311')`)).rows)

  console.log('=== 3. Por nombre, por si la cédula está escrita distinto ===')
  console.table((await c.query(`
    select id, first_name||' '||last_name nombre, cedula, email, is_active
    from members
    where (first_name ilike '%tatiana%' and last_name ilike '%brenes%')
       or (first_name ilike '%eugenia%' and last_name ilike '%arroyo%')
       or (last_name ilike '%brenes arroyo%')`)).rows)

  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

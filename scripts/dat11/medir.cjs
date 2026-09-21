/** SOLO LECTURA · DAT-11: estado actual de las dos fichas de cada correo repetido.
 *
 * El dueño de cada correo lo confirmó Comunicación el 2026-09-21 (ver plan).
 * Este script NO decide nada: enseña qué hay antes de tocar.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const CORREOS = [
  'adripicadom.ap@gmail.com', 'aduarte86@gmail.com', 'avm150593@hotmail.com',
  'cuellarcr@hotmail.com', 'davromen@gmail.com', 'job.morales231099@hotmail.com',
  'katygose@gmail.com', 'lilliana.chavesb30@gmail.com', 'sarguedas@icloud.com',
]

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    select lower(m.email) correo,
           m.id, m.first_name||' '||m.last_name nombre, m.cedula,
           m.birth_date, m.auth_user_id is not null tiene_cuenta,
           u.email correo_de_la_cuenta,
           u.last_sign_in_at::date ultimo_ingreso,
           (select count(*) from event_checkins ci where ci.member_id = m.id) checkins
    from members m
    left join auth.users u on u.id = m.auth_user_id
    where lower(m.email) = any($1) and m.is_active
    order by 1, m.created_at`, [CORREOS])

  for (const correo of CORREOS) {
    console.log(`\n=== ${correo} ===`)
    console.table(rows.filter(r => r.correo === correo).map(r => ({
      nombre: r.nombre, cedula: r.cedula, nacio: r.birth_date,
      cuenta: r.tiene_cuenta ? r.correo_de_la_cuenta : '—',
      ultimo: r.ultimo_ingreso, checkins: Number(r.checkins),
    })))
  }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

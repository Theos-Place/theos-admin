/**
 * Quitar el bloqueo a quienes ya cumplieron 18.
 *
 * El script de FAM-2 los baneó hasta 2126 siendo menores, y su propio comentario
 * dice que "al cumplir 18 basta con quitar el ban" — pero nada lo hace. Saul
 * Sánchez y Esteban Quesada cumplieron el 19 y el 18 de setiembre y siguen sin
 * poder entrar. Hay 8 más que cumplen en octubre.
 *
 * Esto es la corrida manual; el arreglo de fondo es que corra solo (ver el plan).
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const { rows } = await c.query(`
      select u.id, m.first_name||' '||m.last_name persona, m.birth_date::text nacio,
             extract(year from age(m.birth_date))::int edad, u.email
      from auth.users u join members m on m.auth_user_id = u.id
      where u.banned_until > now()
        and m.birth_date is not null
        and age(m.birth_date) >= interval '18 years'
      order by m.birth_date`)
    console.log(`ya son mayores y siguen bloqueados: ${rows.length}`)
    console.table(rows.map(r => ({ persona: r.persona, nacio: r.nacio, edad: r.edad, correo: r.email })))
    if (rows.length) {
      await c.query(`update auth.users set banned_until = null, updated_at = now() where id = any($1)`,
        [rows.map(r => r.id)])
    }
    const quedan = (await c.query(`
      select count(*)::int n from auth.users u join members m on m.auth_user_id = u.id
      where u.banned_until > now() and m.birth_date is not null
        and age(m.birth_date) >= interval '18 years'`)).rows[0].n
    console.log(`mayores que siguen bloqueados (debe ser 0): ${quedan}`)
    if (quedan !== 0) throw new Error('quedó alguno')
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

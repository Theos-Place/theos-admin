/**
 * Dos cuentas quedaron con `banned_until = 'infinity'` y la API de Auth no
 * puede ni leerlas.
 *
 *   dry-run:  node scripts/daniela-2026-10/infinity.cjs
 *   aplicar:  ... --aplicar
 *
 * EL HALLAZGO (2026-10-12, investigando por qué Daniela no podía entrar):
 * `updateUserById` devolvía 500 con un cuerpo vacío para Lidia Arias y Jose
 * Antonio Quirós. No era permiso ni correo repetido: su `banned_until` es el
 * valor `infinity` de Postgres, y GoTrue no sabe convertirlo a una fecha. Ni
 * `getUserById` funciona — devuelve un usuario vacío.
 *
 * O SEA QUE LA API NO PUEDE DESHACERLO. Es la única razón por la que esto se
 * hace con SQL y no con `updateUserById` como el resto: la puerta normal
 * está cerrada desde adentro. GoTrue lee `banned_until` de la base en cada
 * petición, así que ponerlo en NULL surte efecto de inmediato.
 *
 * SOLO LAS QUE TIENEN FICHA VIVA Y SON DE ADULTOS. Hay 7 cuentas con
 * `infinity`; las otras 5 no tienen ficha —nadie está esperando entrar con
 * ellas— y se dejan como están.
 */
const fs = require('fs')
const path = require('path')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const APLICAR = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente()
  await c.connect()

  const { rows } = await c.query(`
    select u.id, u.email, m.first_name || ' ' || m.last_name as persona,
           extract(year from age(m.birth_date))::int as edad
    from auth.users u
    join members m on m.auth_user_id = u.id
    where u.banned_until = 'infinity'
      and m.is_active
      and m.birth_date is not null
      and extract(year from age(m.birth_date)) >= 18`)

  console.log(`cuentas con 'infinity', de adulto con ficha viva: ${rows.length}`)
  console.table(rows.map(r => ({ persona: r.persona, edad: r.edad, correo: r.email })))
  if (!rows.length) { await c.end(); return }
  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); await c.end(); return }

  const respaldo = path.join(__dirname, `rollback-infinity-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  fs.writeFileSync(respaldo, JSON.stringify(rows.map(r => ({ id: r.id, banned_until: 'infinity' })), null, 2))

  const { rowCount } = await c.query(
    `update auth.users set banned_until = null, updated_at = now() where id = any($1::uuid[])`,
    [rows.map(r => r.id)])
  console.log(`\ndesbloqueadas: ${rowCount}\nrespaldo: ${respaldo}`)

  console.table((await c.query(`
    select u.email, m.first_name||' '||m.last_name as persona, u.banned_until
    from auth.users u join members m on m.auth_user_id=u.id
    where u.id = any($1::uuid[])`, [rows.map(r => r.id)])).rows)
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

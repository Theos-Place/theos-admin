/**
 * SOLO LECTURA · El patrón de Tatiana: un correo que NO parece de quien lo
 * tiene en su ficha.
 *
 * Señal: la parte antes de la @ no comparte ninguna palabra con el nombre de la
 * persona. Es una PISTA, no una prueba —hay correos que no llevan el nombre—,
 * así que se filtra además por tener una cuenta creada, que es cuando el
 * problema se vuelve real: alguien entra y ve la ficha de otro.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const normal = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select m.id, m.first_name, m.last_name, m.email, m.cedula, m.birth_date,
           u.id auth_id, u.last_sign_in_at::date ultimo
    from members m
    join auth.users u on lower(u.email) = lower(m.email)
    where m.email is not null and m.is_active
      and m.auth_user_id = u.id
      and m.first_name not ilike '%[prueba]%'`)

  const sospechosos = []
  for (const m of r.rows) {
    const local = normal(m.email.split('@')[0]).replace(/[^a-z]/g, ' ')
    const trozos = local.split(/\s+/).filter(t => t.length >= 4)
    const nombre = normal(`${m.first_name} ${m.last_name}`).split(/\s+/).filter(Boolean)
    // ¿Alguna palabra del correo aparece dentro de alguna del nombre, o al revés?
    const coincide = trozos.some(t => nombre.some(n => n.includes(t) || t.includes(n)))
    if (!coincide && trozos.length) sospechosos.push(m)
  }

  console.log(`cuentas activas revisadas: ${r.rowCount}`)
  console.log(`el correo no se parece al nombre de la ficha: ${sospechosos.length}`)
  console.table(sospechosos
    .sort((a, b) => String(b.ultimo ?? '').localeCompare(String(a.ultimo ?? '')))
    .slice(0, 20)
    .map(m => ({
      persona: `${m.first_name} ${m.last_name}`.slice(0, 30),
      correo: m.email.slice(0, 34),
      cedula: m.cedula ?? '—',
      ultimo_ingreso: m.ultimo ? String(m.ultimo).slice(0, 10) : 'nunca',
    })))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

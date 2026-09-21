/** SOLO LECTURA · Qué se cambió en la ficha de la mamá desde que existe la cuenta. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const MAMA = 'f9453c59-09d0-4f48-96c6-31750fe99f68'
const RUIDO = new Set(['updated_at', 'created_at', 'search_vector', 'sede', 'last_checkin_at'])

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select a.action, a.old_data, a.new_data, a.actor_id,
           to_char(a.created_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') cuando,
           m.first_name||' '||m.last_name actor
    from audit_log a
    left join members m on m.auth_user_id = a.actor_id
    where a.entity_id = $1 order by a.created_at`, [MAMA])

  console.log(`cambios registrados: ${r.rowCount}\n`)
  for (const x of r.rows) {
    // Las anteriores a AUD-1 no guardaron el valor viejo: mostrarlas como si
    // todo hubiera cambiado desde null es ruido, no información.
    if (!x.old_data) { console.log(`${x.cuando} · ${x.action} · sin valor viejo guardado (anterior a AUD-1)\n`); continue }
    const vieja = x.old_data ?? {}
    const nueva = x.new_data ?? {}
    const campos = [...new Set([...Object.keys(vieja), ...Object.keys(nueva)])]
      .filter(k => !RUIDO.has(k))
      .filter(k => JSON.stringify(vieja[k]) !== JSON.stringify(nueva[k]))
    if (!campos.length) { console.log(`${x.cuando} · ${x.action} · (sin cambios visibles)`); continue }
    console.log(`${x.cuando} · ${x.action} · por: ${x.actor ?? x.actor_id ?? 'sin actor'}`)
    for (const k of campos) {
      const a = JSON.stringify(vieja[k]) ?? 'null'
      const b = JSON.stringify(nueva[k]) ?? 'null'
      console.log(`    ${k}: ${a}  →  ${b}`)
    }
    console.log()
  }

  console.log('=== Cómo está HOY la ficha de la mamá ===')
  console.table((await c.query(`
    select first_name, last_name, cedula, email, phone, birth_date::text, gender,
           marital_status, address, is_active
    from members where id=$1`, [MAMA])).rows)

  console.log('=== Cómo está HOY la ficha de Tatiana ===')
  console.table((await c.query(`
    select first_name, last_name, cedula, email, phone, birth_date::text, gender,
           marital_status, address, is_active
    from members where id='25fb745e-97d5-4002-b089-700b65046c5d'`)).rows)

  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

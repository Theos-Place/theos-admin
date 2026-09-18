/**
 * Borra el correo de los servidores cuya dirección REBOTÓ.
 *
 * Decisión del usuario 2026-09-18 sobre los 3 de la lista del anuncio. Un
 * correo que rebota está muerto: mientras siga en la ficha, la pantalla lo
 * muestra como si sirviera y nadie pregunta por uno nuevo.
 *
 * SE BORRA TAMBIÉN LA MARCA DE REBOTE, y esto es lo que importa: `email_bounced`
 * es del MIEMBRO, no de la dirección. Si se deja puesta, el día que alguien le
 * escriba un correo nuevo en la ficha, el sistema lo va a seguir tratando como
 * rebotado y tampoco le va a llegar nada — el problema se mudaría a una
 * dirección buena sin que nadie lo note.
 *
 * Los tres tienen teléfono, así que no quedan incomunicados; y los tres tienen
 * cuenta de acceso con ese mismo correo que NUNCA usaron, así que no se rompe
 * ningún login vivo. La cuenta queda con una dirección muerta: cuando den una
 * nueva hay que mudarle el login también.
 *
 * Se puede deshacer: el valor viejo queda en `audit_log.old_data`.
 * Dry-run por defecto; --aplicar escribe, firmado con la cuenta de quien lo pidió.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const ACTOR = 'ti@theosplace.org'
const CORREOS = ['m.patriciagomez@outlook.com', 'lalo2511@gmail.com', 'jsapri05@hotmail.com']

;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    select id, first_name||' '||last_name nombre, email, phone, coalesce(email_bounced,false) rebotado
    from members where lower(email) = any($1)`, [CORREOS])

  console.log('=== se les borra el correo ===')
  for (const r of rows) {
    if (!r.rebotado) throw new Error(`GUARDA: ${r.nombre} NO tiene el correo rebotado — no se toca`)
    if (!r.phone) throw new Error(`GUARDA: ${r.nombre} quedaría sin ningún contacto — no se toca`)
    console.log(`  ${r.nombre.padEnd(30)} ${r.email.padEnd(32)} queda el tel ${r.phone}`)
  }
  if (rows.length !== CORREOS.length) throw new Error(`GUARDA: se esperaban ${CORREOS.length} fichas y hay ${rows.length}`)
  if (!APLICAR) { console.log('\n>>> DRY-RUN: no se escribió nada'); await c.end(); return }

  const { rows: au } = await c.query('select id from auth.users where email = $1', [ACTOR])
  if (!au.length) throw new Error(`GUARDA: no encuentro ${ACTOR} para firmar el cambio`)
  const ids = rows.map(r => r.id)

  await c.query('begin')
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })])
  await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-actor-user-id': au[0].id })])
  await c.query(`update members set email = null, email_bounced = false, email_bounced_at = null
                 where id = any($1)`, [ids])

  const { rows: post } = await c.query(
    `select count(*) filter (where email is not null) con_correo,
            count(*) filter (where email_bounced) marcados
     from members where id = any($1)`, [ids])
  console.log(`\ncon correo todavía: ${post[0].con_correo} · con marca de rebote: ${post[0].marcados}`)
  if (Number(post[0].con_correo) || Number(post[0].marcados)) { await c.query('rollback'); throw new Error('no quedó limpio — rollback') }
  const { rows: firm } = await c.query(`
    select count(*) n from audit_log where entity_type='members' and entity_id = any($1)
      and actor_id = $2 and new_data ? 'email'`, [ids, au[0].id])
  console.log(`firmados en la bitácora: ${firm[0].n} de ${ids.length}`)
  if (Number(firm[0].n) !== ids.length) { await c.query('rollback'); throw new Error('no quedaron firmados — rollback') }
  await c.query('commit')
  console.log('\n>>> APLICADO. El correo viejo queda en audit_log.old_data.')
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

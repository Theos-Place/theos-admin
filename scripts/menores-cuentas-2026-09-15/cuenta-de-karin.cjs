/**
 * La cuenta de Karin Buscemi estaba colgada de la ficha de su hijo de 8 años.
 *   npx tsx --env-file=.env.local scripts/menores-cuentas-2026-09-15/cuenta-de-karin.cjs [--aplicar]
 *
 * El usuario de Auth se creó el 13-set con karin.buscemi@gmail.com y quedó
 * ligado a la ficha de Miguel Andrés (nacido en 2017). El login del 14-set es
 * de Karin: un niño de 8 años no entra al sistema administrativo.
 *
 * Deshabilitarla —que es lo que se hizo con las otras 196— la dejaría a ELLA
 * sin acceso, y además sin poder crearse una propia: Auth exige correos únicos
 * y el suyo estaba ocupado por este usuario. Por eso la cuenta se MUDA a su
 * ficha en vez de banearse.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')
  const uno = async (s, p) => (await c.query(s, p)).rows[0]

  const hijo = await uno(`select id, first_name||' '||last_name p, auth_user_id, birth_date::text nac
                          from members where search_text ilike '%miguel%alvarez buscemi%' and auth_user_id is not null`)
  const mama = await uno(`select id, first_name||' '||last_name p, email, auth_user_id
                          from members where search_text ilike '%karin%buscemi%' and auth_user_id is null`)
  if (!hijo || !mama) throw new Error('no se encontraron las dos fichas')
  console.log(`hijo: ${hijo.p} (nac ${hijo.nac}) — tiene la cuenta`)
  console.log(`mamá: ${mama.p} (${mama.email}) — sin cuenta\n`)

  // Verificación dura: el correo de la cuenta TIENE que ser el de la mamá. Si
  // no lo fuera, esto sería mover la cuenta de otra persona.
  const u = await uno(`select id, email, last_sign_in_at from auth.users where id = $1`, [hijo.auth_user_id])
  if (String(u.email).toLowerCase() !== String(mama.email).toLowerCase()) {
    throw new Error(`el correo de la cuenta (${u.email}) no es el de la mamá (${mama.email}) — abortar`)
  }
  console.log(`cuenta ${u.email} · último login ${String(u.last_sign_in_at).slice(0, 16)}`)

  await c.query(`update members set auth_user_id = null, updated_at = now() where id = $1`, [hijo.id])
  await c.query(`update members set auth_user_id = $2, updated_at = now() where id = $1`, [mama.id, hijo.auth_user_id])
  // El metadato apuntaba al hijo: lo usa el login para resolver la ficha.
  await c.query(`update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('member_id', $2::text), updated_at = now() where id = $1`,
    [hijo.auth_user_id, mama.id])

  console.log('\n── CÓMO QUEDA:')
  const { rows } = await c.query(`
    select m.first_name||' '||m.last_name p, m.auth_user_id is not null cuenta, u.email, u.banned_until,
           (u.raw_user_meta_data->>'member_id') apunta_a
    from members m left join auth.users u on u.id = m.auth_user_id where m.id in ($1,$2)`, [hijo.id, mama.id])
  rows.forEach(r => console.log(`   ${r.p.padEnd(30)} cuenta=${r.cuenta ? r.email : 'no'} baneada=${r.banned_until ?? 'no'}`))
  const ok = rows.find(r => r.cuenta)
  console.log(`   el metadato apunta a la ficha de la mamá: ${ok?.apunta_a === mama.id ? 'sí ✓' : 'NO ⚠️'}`)
  if (ok?.apunta_a !== mama.id) { await c.query('rollback'); console.log('\n❌ Rollback.'); await c.end(); return }

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

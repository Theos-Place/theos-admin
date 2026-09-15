/**
 * FAM-2 Parte B, paso 1 · Deshabilitar las cuentas de menores que quedaron de
 * corridas anteriores.
 *   npx tsx --env-file=.env.local scripts/menores-cuentas-2026-09-15/deshabilitar.cjs [--aplicar]
 *
 * La regla nueva impide CREAR cuentas a menores; estas ya existían (AUTH-1 usaba
 * un umbral de 12 años). Ninguna se usó nunca para entrar — la única excepción
 * se trata aparte, ver abajo.
 *
 * SE BANEA, NO SE BORRA, y se conserva el auth_user_id ligado a la ficha. Mismo
 * criterio que la fusión: el historial sigue existiendo y al cumplir 18 basta
 * con quitar el ban, sin tener que recrear nada ni pelear con el correo, que
 * seguiría ocupado por el usuario viejo.
 *
 * EXCLUIDO A PROPÓSITO · Miguel Andrés Álvarez Buscemi, 8 años. Su "cuenta de
 * menor" tiene el correo de su mamá, Karin Buscemi, y el login del 14-set es de
 * ella: Karin no tiene cuenta propia porque este usuario le ocupa el correo.
 * Deshabilitarla la dejaría a ELLA sin acceso. Ese caso se arregla mudando la
 * cuenta a la ficha de Karin, no baneándola.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const HASTA = '2126-01-01T00:00:00Z'   // el mismo "para siempre" que usa la fusión

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows } = await c.query(`
    select m.id, m.first_name||' '||m.last_name p, extract(year from age(m.birth_date))::int edad,
           m.auth_user_id, u.email, u.last_sign_in_at, u.banned_until
    from members m join auth.users u on u.id = m.auth_user_id
    where m.is_active and m.birth_date is not null
      and m.birth_date > (current_date - interval '18 years')
    order by edad desc, 2`)

  const usadas = rows.filter(r => r.last_sign_in_at)
  const aBanear = rows.filter(r => !r.last_sign_in_at && !r.banned_until)

  console.log(`menores con cuenta: ${rows.length}`)
  console.log(`  nunca se usaron → SE DESHABILITAN: ${aBanear.length}`)
  console.log(`  se usaron para entrar → NO se tocan acá: ${usadas.length}`)
  usadas.forEach(r => console.log(`     ${r.p} (${r.edad}a) · ${r.email} · último login ${String(r.last_sign_in_at).slice(0,10)}`))

  const porEdad = new Map()
  for (const r of aBanear) porEdad.set(r.edad, (porEdad.get(r.edad) ?? 0) + 1)
  console.log('\n  por edad:')
  ;[...porEdad].sort((a, b) => a[0] - b[0]).forEach(([e, n]) => console.log(`     ${String(e).padStart(2)} años: ${n}`))

  const { rowCount } = await c.query(
    `update auth.users set banned_until = $2, updated_at = now() where id = any($1)`,
    [aBanear.map(r => r.auth_user_id), HASTA])
  console.log(`\ndeshabilitadas: ${rowCount}`)

  // Guardias: nadie que haya entrado alguna vez debe quedar baneado, y ningún
  // ADULTO debe verse afectado.
  const { rows: [g] } = await c.query(`
    select count(*) filter (where u.last_sign_in_at is not null and u.banned_until = $2)::int usadas_baneadas,
           count(*) filter (where u.banned_until = $2 and (m.birth_date is null or m.birth_date <= (current_date - interval '18 years')))::int adultos_baneados
    from auth.users u join members m on m.auth_user_id = u.id
    where u.id = any($1)`, [aBanear.map(r => r.auth_user_id), HASTA])
  console.log(`cuentas usadas que quedaron baneadas: ${g.usadas_baneadas} ${g.usadas_baneadas === 0 ? '✓' : '⚠️'}`)
  console.log(`adultos afectados:                    ${g.adultos_baneados} ${g.adultos_baneados === 0 ? '✓' : '⚠️'}`)
  if (g.usadas_baneadas > 0 || g.adultos_baneados > 0) { await c.query('rollback'); console.log('\n❌ Rollback.'); await c.end(); return }

  fs.writeFileSync('data-import/menores-cuentas-deshabilitadas-2026-09-15.csv',
    [['Persona', 'Edad', 'Correo de la cuenta'], ...aBanear.map(r => [r.p, r.edad, r.email])]
      .map(x => x.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'))
  console.log('CSV: data-import/menores-cuentas-deshabilitadas-2026-09-15.csv')

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

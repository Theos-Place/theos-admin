/**
 * FAM-2 · Parte B, pasos 1 y 5 · Los dos reportes que el brief pide y que NO
 * se resuelven solos. Solo lee.
 *   npx tsx --env-file=.env.local scripts/familias-2026-09-15/menores-a-revisar.cjs
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const MENOR = `m.birth_date is not null and m.birth_date > (current_date - interval '18 years')`

;(async () => {
  const c = L.nuevoCliente(); await c.connect()

  // 1 · Menores que YA tienen cuenta de corridas anteriores. La regla nueva
  //     impide crear más; estas ya existen y deshabilitarlas es decisión del
  //     usuario, no del script.
  const { rows: conCuenta } = await c.query(`
    select m.first_name||' '||m.last_name p, extract(year from age(m.birth_date))::int edad,
           m.email, m.last_sign_in_at is not null entro
    from members m where m.is_active and ${MENOR} and m.auth_user_id is not null
    order by edad, 1`)
  const usadas = conCuenta.filter(r => r.entro).length
  console.log(`1) MENORES CON CUENTA YA CREADA: ${conCuenta.length}  (de esas, ${usadas} se usaron para entrar)`)
  conCuenta.slice(0, 12).forEach(r => console.log(`   ${String(r.edad).padStart(2)}a  ${r.p.padEnd(32)} ${r.email ?? '—'}${r.entro ? '  · YA ENTRÓ' : ''}`))
  if (conCuenta.length > 12) console.log(`   … y ${conCuenta.length - 12} más (ver el CSV)`)

  // 5 · Los que ya cumplieron 18 y nunca tuvieron cuenta: candidatos a que se
  //     les ofrezca el alta. No se automatiza nada (decisión del usuario).
  const { rows: cumplieron } = await c.query(`
    select m.first_name||' '||m.last_name p, m.email,
           extract(year from age(m.birth_date))::int edad, m.birth_date::text nacimiento
    from members m
    where m.is_active and m.auth_user_id is null and m.birth_date is not null
      and m.birth_date <= (current_date - interval '18 years')
      and m.birth_date > (current_date - interval '19 years')
    order by m.birth_date`)
  console.log(`\n5) CUMPLIERON 18 EN EL ÚLTIMO AÑO Y NO TIENEN CUENTA: ${cumplieron.length}`)
  cumplieron.slice(0, 10).forEach(r => console.log(`   ${r.nacimiento}  ${r.p.padEnd(32)} ${r.email ?? 'sin correo'}`))

  // Contexto: quién queda sin ninguna vía de contacto.
  const { rows: [q] } = await c.query(`
    select count(*) filter (where not exists (select 1 from family_members f where f.member_id=m.id))::int sin_familia,
           count(*)::int total
    from members m where m.is_active and ${MENOR}`)
  console.log(`\nCONTEXTO · menores activos: ${q.total} · sin familia vinculada: ${q.sin_familia}`)

  const csv = (nombre, cab, filas) => {
    fs.writeFileSync(`data-import/${nombre}`, [cab, ...filas].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'))
    console.log(`CSV: data-import/${nombre}`)
  }
  csv('menores-con-cuenta-2026-09-15.csv', ['Persona', 'Edad', 'Correo', 'Ya entró'],
    conCuenta.map(r => [r.p, r.edad, r.email, r.entro ? 'sí' : 'no']))
  csv('cumplieron-18-sin-cuenta-2026-09-15.csv', ['Persona', 'Nacimiento', 'Correo'],
    cumplieron.map(r => [r.p, r.nacimiento, r.email]))
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

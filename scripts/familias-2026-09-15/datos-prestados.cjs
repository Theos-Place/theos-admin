/**
 * FAM-2 · Parte B, paso 4 · Quitarle al menor el teléfono o el correo que en
 * realidad es del papá o de la mamá.
 *   npx tsx --env-file=.env.local scripts/familias-2026-09-15/datos-prestados.cjs [--aplicar]
 *
 * No es un dato del menor: es el número que un adulto puso en algún formulario.
 * Duplica el contacto, ensucia las búsquedas y hace que el dedup empareje a un
 * niño con su madre.
 *
 * VA DESPUÉS DE LA PARTE A y no antes: sin la familia vinculada no se sabe de
 * quién es el número, y lo único que se podría hacer es adivinar por apellido.
 *
 * Solo se borra si un ADULTO DE SU MISMA FAMILIA lo tiene igual. Un teléfono
 * que no coincide con nadie se queda: puede ser el celular real del adolescente.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const { mismoTelefono, mismoCorreo } = await import('../../src/lib/members/reglas-de-menores.ts')
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  // Menores CON familia y con algún dato de contacto, junto a los adultos de su
  // hogar. "Adulto" = mayor de edad o sin fecha: si no se sabe, no se asume que
  // es otro menor.
  const { rows } = await c.query(`
    select mn.id, mn.first_name||' '||mn.last_name persona,
           extract(year from age(mn.birth_date))::int edad,
           mn.email, mn.phone,
           a.first_name||' '||a.last_name adulto, a.email a_email, a.phone a_phone
    from members mn
    join family_members f on f.member_id = mn.id
    join family_members fa on fa.family_unit_id = f.family_unit_id and fa.member_id <> mn.id
    join members a on a.id = fa.member_id
    where mn.is_active and mn.birth_date is not null
      and mn.birth_date > (current_date - interval '18 years')
      and (a.birth_date is null or a.birth_date <= (current_date - interval '18 years'))
      and ((mn.phone is not null and btrim(mn.phone) <> '') or (mn.email is not null and btrim(mn.email) <> ''))`)

  const porMenor = new Map()
  for (const r of rows) {
    if (!porMenor.has(r.id)) porMenor.set(r.id, { ...r, adultos: [] })
    porMenor.get(r.id).adultos.push({ nombre: r.adulto, email: r.a_email, phone: r.a_phone })
  }

  const tel = [], mail = []
  for (const m of porMenor.values()) {
    const dueñoTel = m.adultos.find(a => mismoTelefono(m.phone, a.phone))
    const dueñoMail = m.adultos.find(a => mismoCorreo(m.email, a.email))
    if (dueñoTel) tel.push({ ...m, de: dueñoTel.nombre })
    if (dueñoMail) mail.push({ ...m, de: dueñoMail.nombre })
  }

  console.log(`menores con familia y algún contacto propio: ${porMenor.size}\n`)
  console.log(`TELÉFONOS prestados de un adulto de su familia: ${tel.length}`)
  tel.slice(0, 15).forEach(m => console.log(`   ${m.persona.padEnd(32)} ${String(m.edad).padStart(2)}a  ${m.phone}  ← de ${m.de}`))
  if (tel.length > 15) console.log(`   … y ${tel.length - 15} más`)
  console.log(`\nCORREOS prestados: ${mail.length}`)
  mail.slice(0, 15).forEach(m => console.log(`   ${m.persona.padEnd(32)} ${String(m.edad).padStart(2)}a  ${m.email}  ← de ${m.de}`))
  if (mail.length > 15) console.log(`   … y ${mail.length - 15} más`)

  const { rowCount: t } = await c.query(`update members set phone = null, updated_at = now() where id = any($1)`, [tel.map(m => m.id)])
  const { rowCount: e } = await c.query(`update members set email = null, updated_at = now() where id = any($1)`, [mail.map(m => m.id)])
  console.log(`\nlimpiados: ${t} teléfonos · ${e} correos`)

  // Guardia: nadie puede quedar sin NINGUNA vía de contacto y sin familia. Los
  // que se tocan acá están todos en una familia por construcción, pero el
  // chequeo es barato y el error sería grave.
  const { rows: [q] } = await c.query(`
    select count(*)::int n from members m
    where m.id = any($1) and not exists (select 1 from family_members f where f.member_id = m.id)`,
    [[...tel.map(m => m.id), ...mail.map(m => m.id)]])
  console.log(`tocados que quedaron sin familia: ${q.n}  ${q.n === 0 ? '✓' : '⚠️  ABORTAR'}`)
  if (q.n > 0) { await c.query('rollback'); console.log('\n❌ Rollback.'); await c.end(); return }

  fs.writeFileSync('data-import/menores-datos-prestados-2026-09-15.csv',
    [['Persona', 'Edad', 'Dato', 'Valor', 'Era de'],
     ...tel.map(m => [m.persona, m.edad, 'teléfono', m.phone, m.de]),
     ...mail.map(m => [m.persona, m.edad, 'correo', m.email, m.de])]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'))
  console.log('CSV: data-import/menores-datos-prestados-2026-09-15.csv')

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

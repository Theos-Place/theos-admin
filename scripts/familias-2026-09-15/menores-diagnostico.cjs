/** FAM-2 · Parte B, paso 0 · Qué pasa hoy con los menores. Solo lee. */
const L = require('../madre-2026-09/lib.cjs')
const MENOR = `m.birth_date is not null and m.birth_date > (current_date - interval '18 years')`
;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const { rows: [q] } = await c.query(`
    select
      count(*) filter (where ${MENOR})::int menores,
      count(*) filter (where m.birth_date is null)::int sin_fecha,
      count(*) filter (where ${MENOR} and m.auth_user_id is not null)::int menores_con_cuenta,
      count(*) filter (where ${MENOR} and not exists (select 1 from family_members f where f.member_id=m.id))::int menores_sin_familia,
      count(*) filter (where ${MENOR} and m.email is not null and btrim(m.email)<>'')::int menores_con_correo,
      count(*) filter (where ${MENOR} and m.phone is not null and btrim(m.phone)<>'')::int menores_con_tel
    from members m where m.is_active`)
  console.log('menores activos:', q.menores, '· sin fecha de nacimiento (no se puede saber):', q.sin_fecha)
  console.log('  con cuenta de login:', q.menores_con_cuenta)
  console.log('  sin familia vinculada:', q.menores_sin_familia)
  console.log('  con correo propio:', q.menores_con_correo, '· con teléfono:', q.menores_con_tel)

  console.log('\n── TELÉFONOS PRESTADOS (igual al de un adulto de su familia):')
  const { rows: tel } = await c.query(`
    with menor as (
      select m.id, m.first_name||' '||m.last_name p, m.phone, fm.family_unit_id u,
             extract(year from age(m.birth_date))::int edad
      from members m join family_members fm on fm.member_id=m.id
      where m.is_active and ${MENOR} and m.phone is not null and btrim(m.phone)<>'')
    select mn.p, mn.edad, mn.phone,
           string_agg(distinct a.first_name||' '||a.last_name, ', ') adultos
    from menor mn
    join family_members fa on fa.family_unit_id = mn.u and fa.member_id <> mn.id
    join members a on a.id = fa.member_id
    where a.birth_date is null or a.birth_date <= (current_date - interval '18 years')
      and regexp_replace(coalesce(a.phone,''),'\\D','','g') = regexp_replace(mn.phone,'\\D','','g')
      and regexp_replace(mn.phone,'\\D','','g') <> ''
    group by 1,2,3 limit 15`)
  tel.forEach(r => console.log(`   ${r.p.padEnd(30)} ${r.edad}a  ${r.phone}  ← también de: ${r.adultos}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

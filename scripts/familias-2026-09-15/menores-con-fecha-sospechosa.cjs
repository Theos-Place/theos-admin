/**
 * De los menores SIN FAMILIA, cuáles probablemente no son menores: la fecha de
 * nacimiento está mal. Solo lee.
 *   npx tsx --env-file=.env.local scripts/familias-2026-09-15/menores-con-fecha-sospechosa.cjs
 *
 * La pista es del usuario (15-set): "hay algunos que pueden tener mal la fecha,
 * por ejemplo si han llevado estudios o sus asistencias no son a grupos de
 * youth". Una fecha mal digitada convierte a un adulto en menor, y con la regla
 * nueva eso le quita la cuenta y le saca el correo de los formularios.
 *
 * Señales, de más fuerte a más débil:
 *  · Estudios de ADULTO (los de la cadena de dirigentes y capacitaciones). Un
 *    niño de 7 años no lleva Cómo Dar Estudios Bíblicos.
 *  · Cédula registrada. A un menor casi nunca se le anota.
 *  · Asistencia a charlas que NO son Youth.
 *  · Servicio activo o pagos.
 *  · La fecha de nacimiento cae A DÍAS de cuando se creó la ficha. Daniela
 *    Céspedes "nació" el mismo día que se registró y Vanessa Fernández un día
 *    antes: eso no es un recién nacido inscrito, es la fecha de REGISTRO metida
 *    en el campo de nacimiento.
 *
 * No se corrige nada solo: la fecha correcta no está en ninguna fuente que
 * tengamos, hay que preguntarla.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const MENOR = `m.birth_date is not null and m.birth_date > (current_date - interval '18 years')`

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    with menores as (
      select m.id, m.first_name||' '||m.last_name p, m.birth_date::text nac,
             extract(year from age(m.birth_date))::int edad, m.cedula, m.email, m.phone
             , (m.created_at at time zone 'America/Costa_Rica')::date::text ficha_creada
             , abs(((m.created_at at time zone 'America/Costa_Rica')::date - m.birth_date)) dias_hasta_la_ficha
      from members m where m.is_active and ${MENOR}
        and not exists (select 1 from family_members f where f.member_id=m.id))
    select mn.*,
      (select count(*)::int from study_enrollments se where se.member_id=mn.id) estudios,
      (select string_agg(distinct coalesce(p1.name, p2.name), ', ')
         from study_enrollments se
         left join study_groups g on g.id = se.group_id
         left join study_plans p1 on p1.id = g.plan_id
         left join study_plans p2 on p2.id = se.plan_id
         where se.member_id = mn.id) que_estudios,
      (select count(*)::int from volunteers v where v.member_id=mn.id and v.status='active') servicios,
      (select count(*)::int from event_checkins ec join events e on e.id=ec.event_id
         where ec.member_id=mn.id and e.title not ilike '%youth%') no_youth,
      (select count(*)::int from event_checkins ec join events e on e.id=ec.event_id
         where ec.member_id=mn.id and e.title ilike '%youth%') youth
    from menores mn
    where (select count(*) from study_enrollments se where se.member_id=mn.id) > 0
       or mn.cedula is not null
       or (select count(*) from volunteers v where v.member_id=mn.id and v.status='active') > 0
       or mn.dias_hasta_la_ficha <= 60
    order by mn.edad, mn.p`)

  console.log(`menores sin familia con señales de ser ADULTOS: ${rows.length}\n`)
  for (const r of rows) {
    const señales = []
    if (r.estudios) señales.push(`${r.estudios} estudio(s)`)
    if (r.cedula) señales.push(`cédula ${r.cedula}`)
    if (r.servicios) señales.push(`${r.servicios} servicio(s)`)
    if (r.no_youth && !r.youth) señales.push(`${r.no_youth} charlas, ninguna Youth`)
    if (r.dias_hasta_la_ficha <= 60) señales.push(`la ficha se creó ${r.dias_hasta_la_ficha} días después de esa "fecha de nacimiento"`)
    console.log(`   ${String(r.edad).padStart(2)}a (nac ${r.nac})  ${r.p}`)
    console.log(`        ${señales.join(' · ')}`)
    if (r.que_estudios) console.log(`        estudios: ${r.que_estudios}`)
  }

  fs.writeFileSync('data-import/menores-fecha-sospechosa-2026-09-15.csv',
    [['Persona', 'Nacimiento', 'Edad', 'Cédula', 'Estudios', 'Cuáles', 'Charlas no-Youth', 'Charlas Youth', 'Correo', 'Teléfono'],
     ...rows.map(r => [r.p, r.nac, r.edad, r.cedula, r.estudios, r.que_estudios, r.no_youth, r.youth, r.email, r.phone])]
      .map(x => x.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'))
  console.log('\nCSV: data-import/menores-fecha-sospechosa-2026-09-15.csv')
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

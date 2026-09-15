/**
 * Vaciar la fecha de nacimiento de quien figura con menos de 12 años y llevó
 * estudios.
 *   npx tsx --env-file=.env.local scripts/familias-2026-09-15/fecha-imposible-por-estudios.cjs [--aplicar]
 *
 * REGLA DEL USUARIO (15-set): "de todos los que han llevado estudios, 100%
 * seguro que no pueden tener menos de 12, eso ni aplica". Los estudios arrancan
 * a los 12; una ficha con estudios y 7 años tiene la fecha mal, no una
 * excepción.
 *
 * Y hay casos con prueba propia, sin depender de la regla: Victoria Arce
 * figura nacida el 2019-01-02 y completó una Campaña matriculada el
 * 2019-06-01, cinco meses después. Eso no es una edad rara, es una fecha falsa.
 *
 * Se vacía en vez de adivinar: la fecha real no está en ninguna fuente. Una
 * fecha falsa hace daño activo —con la regla de menores le quita la cuenta a la
 * persona y la saca de los formularios que piden correo— y NULL solo dice la
 * verdad. El respaldo es el CSV que este script escribe y SOLO ese: el trigger
 * audit_members guarda old_data en null.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const M12 = `m.birth_date is not null and m.birth_date > (current_date - interval '12 years')`

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows } = await c.query(`
    select m.id, m.first_name||' '||m.last_name p, m.birth_date::text nac,
      extract(year from age(m.birth_date))::int edad, m.email, m.phone, m.cedula,
      (select count(*)::int from study_enrollments se where se.member_id=m.id) n,
      (select string_agg(distinct coalesce(p1.name,p2.name), ', ') from study_enrollments se
         left join study_groups g on g.id=se.group_id left join study_plans p1 on p1.id=g.plan_id
         left join study_plans p2 on p2.id=se.plan_id where se.member_id=m.id) cuales,
      (select min(se.enrolled_at)::date::text from study_enrollments se where se.member_id=m.id) primera_matricula,
      exists(select 1 from family_members f where f.member_id=m.id) familia
    from members m where m.is_active and ${M12}
      and exists (select 1 from study_enrollments se where se.member_id=m.id)
    order by edad, 1`)

  console.log(`fichas con estudios y menos de 12 años: ${rows.length}\n`)
  rows.forEach(r => {
    const imposible = r.primera_matricula && r.primera_matricula < r.nac
    const casiBebe = r.primera_matricula && (new Date(r.primera_matricula) - new Date(r.nac)) / 31536000000 < 3
    console.log(`   ${String(r.edad).padStart(2)}a (${r.nac}) ${r.p.padEnd(30)} ${r.n} estudios · 1ª matrícula ${r.primera_matricula}`)
    console.log(`        ${r.cuales}`)
    if (imposible) console.log(`        ⚠️  se matriculó ANTES de su "nacimiento"`)
    else if (casiBebe) console.log(`        ⚠️  se matriculó con menos de 3 "años"`)
  })

  fs.writeFileSync('data-import/fechas-vaciadas-por-estudios-2026-09-15.csv',
    [['Persona', 'Fecha que tenía', 'Edad que decía', 'Estudios', 'Cuáles', 'Primera matrícula', 'En familia', 'Correo', 'Teléfono'],
     ...rows.map(r => [r.p, r.nac, r.edad, r.n, r.cuales, r.primera_matricula, r.familia ? 'sí' : 'no', r.email, r.phone])]
      .map(x => x.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'))

  const { rowCount } = await c.query(`update members set birth_date=null, updated_at=now() where id = any($1)`, [rows.map(r => r.id)])
  console.log(`\nvaciadas: ${rowCount}`)

  const { rows: [g] } = await c.query(`select count(*)::int n from members m where m.is_active and ${M12}
    and exists (select 1 from study_enrollments se where se.member_id=m.id)`)
  const { rows: [t] } = await c.query(`select count(*)::int n from members m
    where m.is_active and m.birth_date is not null and m.birth_date > (current_date - interval '18 years')`)
  console.log(`   quedan con estudios y menos de 12: ${g.n} ${g.n === 0 ? '✓' : '⚠️'}`)
  console.log(`   menores activos: ${t.n}`)
  if (g.n > 0) { await c.query('rollback'); console.log('\n❌ Rollback.'); await c.end(); return }
  console.log('CSV: data-import/fechas-vaciadas-por-estudios-2026-09-15.csv')

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

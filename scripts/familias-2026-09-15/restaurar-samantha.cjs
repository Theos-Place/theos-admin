/**
 * Devolverle la fecha de nacimiento a Samantha Cubillo.
 *   npx tsx --env-file=.env.local scripts/familias-2026-09-15/restaurar-samantha.cjs [--aplicar]
 *
 * Se la vacié aplicando la regla "con estudios no se puede tener menos de 12".
 * La regla es correcta; el caso no: el usuario confirmó que Samantha SÍ es
 * niña. O sea lo que está mal no es su fecha sino sus matrículas — alguien
 * matriculó a la persona equivocada.
 *
 * Era la única de las 7 sin prueba propia: las otras cuatro se matricularon
 * con menos de 3 "años" de edad, que es imposible por sí solo. Samantha se
 * matriculó a los 10,7, que es raro pero no imposible. Esa diferencia era la
 * señal y no la usé para frenar.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const FECHA = '2014-10-03'   // de data-import/fechas-vaciadas-por-estudios-2026-09-15.csv

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')
  const uno = async (s, p) => (await c.query(s, p)).rows[0]

  const m = await uno(`select id, first_name||' '||last_name p, birth_date::text nac, external_id
                       from members where search_text ilike '%samantha%cubillo%' and is_active`)
  console.log(`${m.p} (ext ${m.external_id}) · fecha ahora: ${m.nac ?? '(vacía)'}`)
  if (m.nac) { console.log('ya tiene fecha, nada que hacer'); await c.query('rollback'); await c.end(); return }

  await c.query(`update members set birth_date=$2, updated_at=now() where id=$1`, [m.id, FECHA])
  const fin = await uno(`select birth_date::text nac, extract(year from age(birth_date))::int edad from members where id=$1`, [m.id])
  console.log(`restaurada: ${fin.nac} (${fin.edad} años)`)

  console.log('\n── SUS MATRÍCULAS, que son lo que hay que revisar:')
  const { rows: e } = await c.query(`
    select coalesce(p1.name,p2.name) plan, se.status, se.enrolled_at::date::text cuando,
           g.name grupo, se.grade nota
    from study_enrollments se left join study_groups g on g.id=se.group_id
    left join study_plans p1 on p1.id=g.plan_id left join study_plans p2 on p2.id=se.plan_id
    where se.member_id=$1 order by 3`, [m.id])
  e.forEach(r => console.log(`   ${r.cuando}  ${String(r.plan).padEnd(14)} ${r.status.padEnd(12)} nota=${r.nota ?? '—'} · ${r.grupo ?? 'sin grupo'}`))
  console.log('\n   NO se tocan acá: borrar una matrícula es otra decisión y puede ser')
  console.log('   que sí las llevó (hay estudios que sí admiten menores con permiso).')

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

/** SOLO LECTURA: historia de Victoria Delgado y Jonathan Valverde en Nivel 2/3. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  for (const q of ['%victoria%delgado%','%jonathan%valverde%']) {
    const f = await c.query(`select id, first_name||' '||last_name as n, email, external_id, is_active
      from members where unaccent(lower(first_name||' '||last_name)) like $1 order by is_active desc`,[q])
    console.log(`\n######## ${q} (${f.rowCount} fichas) ########`)
    f.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
    for (const r of f.rows) {
      const e = await c.query(`
        select e.id, e.status, e.grade, e.notes, e.enrolled_at, e.dropped_at, e.drop_reason, e.completed_at,
               g.id as gid, g.name as grupo, g.status as estado_grupo, g.closed_at, pl.code, pl.name as plan
        from study_enrollments e join study_groups g on g.id=e.group_id
          left join study_plans pl on pl.id=g.plan_id
        where e.member_id=$1 and (pl.code in ('N1','N2','N3','N4') or g.created_at > now() - interval '6 months')
        order by e.created_at desc limit 8`,[r.id])
      e.rows.forEach(x => console.log(`    [${x.code ?? '—'}] ${x.grupo}\n        estado=${x.status} nota=${x.grade ?? '—'} grupo=${x.estado_grupo} cerrado=${x.closed_at ? x.closed_at.toISOString().slice(0,10) : 'no'}${x.notes ? '\n        notes='+x.notes : ''}${x.drop_reason ? '\n        baja: '+x.drop_reason : ''}`))
    }
  }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

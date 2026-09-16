/** SOLO LECTURA: ocupación real de LECTPROP y ROM, con los estados que ocupan. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const OCUPAN = ['enrolled','pendiente_de_pago','waitlist','completed','reprobado']
;(async () => {
  const c = nuevoCliente(); await c.connect()
  for (const [nom, gid] of [['LECTPROP — La Sabana','253a16e5-ece9-44e8-bfaa-d7717db37b95'],
                            ['ROM — Finca Sasso','188c02ae-acd2-40da-b369-fe6d87dea73c']]) {
    const r = await c.query(`
      select e.status, count(*) as n
      from study_enrollments e where e.group_id = $1 group by e.status order by 2 desc`, [gid])
    const g = await c.query(`select max_students, status from study_groups where id=$1`, [gid])
    const ocupa = r.rows.filter(x => OCUPAN.includes(x.status)).reduce((a,b)=>a+Number(b.n),0)
    console.log(`\n${nom} — cupo ${g.rows[0].max_students}, estado ${g.rows[0].status}`)
    r.rows.forEach(x => console.log(`   ${x.status}: ${x.n}${OCUPAN.includes(x.status)?'  (ocupa)':''}`))
    console.log(`   >>> OCUPADOS REALES: ${ocupa} de ${g.rows[0].max_students}`)
  }
  // ¿Otros grupos de Lecturas con Propósito con cupo?
  const o = await c.query(`
    select g.id, g.name, g.status, g.max_students, g.starts_at,
      (select count(*) from study_enrollments e where e.group_id=g.id and e.status = any($2)) as ocupados
    from study_groups g where g.plan_id = $1 and g.starts_at > now() - interval '2 months'
    order by g.starts_at`, ['ff8b6e29-4bc4-4cc5-9dcb-b14a581047b4', OCUPAN])
  console.log('\n=== TODOS los grupos de Lecturas con Propósito vigentes ===')
  o.rows.forEach(x => console.log(JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

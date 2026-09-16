/** SOLO LECTURA: estado AHORA de cada persona de la pantalla de pagos. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const NOMBRES = [
  'yanil%gutierrez','pamela%fonseca','ileana%salazar','freima%chavarria','catalina%arce',
  'wendel%arias','mariana%arguedas','alberto%vargas%carpio','daniel%alfaro%cardoza',
  'paula%garcia%apu','john%badilla','stephanie%cordero','irina%morales',
]
;(async () => {
  const c = nuevoCliente(); await c.connect()
  for (const n of NOMBRES) {
    const f = await c.query(`select id, first_name||' '||last_name as nom from members
      where unaccent(lower(first_name||' '||last_name)) like $1 order by is_active desc limit 1`, ['%'+n+'%'])
    if (!f.rowCount) { console.log(`${n}: NO ENCONTRADO`); continue }
    const { id, nom } = f.rows[0]
    const p = await c.query(`
      select pa.amount, pa.status, pa.concept, pa.review_status, pa.payment_method,
             coalesce(g.name, pa.description, '—') as sobre
      from payments pa left join study_groups g on g.id=pa.study_group_id
      where pa.member_id=$1 and pa.status in ('pending','paid') order by pa.created_at desc limit 4`, [id])
    const linea = p.rows.map(x => `₡${Number(x.amount)} ${x.status}${x.review_status?'/'+x.review_status:''} [${x.concept}]`).join('  ·  ') || 'SIN PAGOS VIVOS'
    const pend = p.rows.filter(x => x.status === 'pending').length
    console.log(`${pend ? '>>> PENDIENTE ' : '    ok        '} ${nom.padEnd(30)} ${linea}`)
  }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

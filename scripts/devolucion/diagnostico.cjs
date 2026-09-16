/** SOLO LECTURA: pagos de Irina Morales e Irene Arias. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  for (const q of ['%irina%morales%','%irene%arias%']) {
    const f = await c.query(`select id, first_name||' '||last_name as nom, cedula, email from members
      where unaccent(lower(first_name||' '||last_name)) like $1 order by is_active desc`, [q])
    console.log(`\n######## ${q} ########`)
    for (const m of f.rows) {
      console.log(`  ${m.nom} (${m.cedula ?? 'sin cédula'})`)
      const p = await c.query(`
        select pa.id, pa.amount, pa.status, pa.concept, pa.description, pa.payment_method,
               pa.review_status, pa.receipt_path is not null as recibo, pa.reference_code,
               pa.enrollment_id, pa.study_group_id, g.name as grupo, pa.paid_at, pa.created_at
        from payments pa left join study_groups g on g.id=pa.study_group_id
        where pa.member_id=$1 order by pa.created_at`, [m.id])
      p.rows.forEach(x => { console.log('    --- PAGO'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!==''&&v!==false) console.log(`        ${k}: ${JSON.stringify(v)}`) })
    }
  }
  // ¿Cómo se ve la tabla de devoluciones?
  const cc = await c.query(`select column_name, data_type from information_schema.columns where table_name='refunds' and table_schema='public' order by ordinal_position`)
  console.log('\n=== columnas de refunds ===\n' + cc.rows.map(r=>`${r.column_name} (${r.data_type})`).join(', '))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const ENR='7dfcb575-84b4-46a1-aefe-f1e3353ff994', PAGO='6c6986cf-390b-4cd4-a86f-6ec65d63f38b'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const fk = await c.query(`
    select cl.relname tabla, pg_get_constraintdef(con.oid) d
    from pg_constraint con join pg_class cl on cl.oid=con.conrelid
    where con.contype='f' and pg_get_constraintdef(con.oid) like '%REFERENCES study_enrollments%'`)
  console.log('=== tablas que referencian study_enrollments ===')
  for (const x of fk.rows) {
    const col = x.d.match(/FOREIGN KEY \((\w+)\)/)[1]
    const n = await c.query(`select count(*) n from ${x.tabla} where ${col}=$1`, [ENR])
    console.log(`  ${x.tabla}.${col}: ${n.rows[0].n} fila(s)   [${x.d.includes('CASCADE') ? 'CASCADE' : x.d.includes('SET NULL') ? 'SET NULL' : 'RESTRICT'}]`)
  }
  const a = await c.query(`select count(*) n from study_attendance where enrollment_id=$1`, [ENR]).catch(() => ({rows:[{n:'(no existe la columna)'}]}))
  console.log(`\nasistencia registrada: ${a.rows[0].n}`)
  const p = await c.query(`select receipt_path, paid_at, review_status, status from payments where id=$1`, [PAGO])
  console.log('el pago: ' + JSON.stringify(p.rows[0]))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

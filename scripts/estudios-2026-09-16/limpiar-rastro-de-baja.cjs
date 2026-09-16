/**
 * Limpiar el rastro de baja de las matrículas que fueron REINCORPORADAS.
 *   npx tsx --env-file=.env.local scripts/estudios-2026-09-16/limpiar-rastro-de-baja.cjs [--aplicar]
 *
 * `dropped_at` y `drop_reason` se escribían al retirar y no se limpiaban al
 * volver a matricular (arreglado hoy en enrollMember). Las filas viejas quedaron
 * diciendo dos cosas a la vez: estado 'enrolled' y fecha de retiro puesta, con
 * un motivo que dice "canceló la matrícula" en alguien que está cursando.
 *
 * SOLO se tocan las que están en un estado de PARTICIPACIÓN. Las otras 15 filas
 * con dropped_at NO son inconsistentes y quedan como están:
 *
 *  · 14 con estado 'cancelada' — es una baja legítima (estadoDeBaja('cancelar')),
 *    así que su fecha y su motivo son correctos. Lo que faltaba era tener a
 *    'cancelada' en RELEASING_STATUSES, y eso se corrige aparte.
 *  · 1 con estado 'reprobado' y SIN dropped_at: ahí drop_reason se usó como
 *    NOTA del resultado ("Por temas personales no aprueban N4. Desean repetir
 *    en 2026 N3 y N4"). Borrarlo destruiría la explicación de por qué reprobó.
 *
 * La prueba de que son reincorporaciones y no bajas a medias: seis tienen un
 * pago 'paid'. El ciclo fue matricularse, perder el cupo por no subir el
 * comprobante, pagar y volver.
 *
 * La séptima —Sofía Solís, motivo "Soy la dirigente"— no tiene ningún pago, y
 * es correcto: es la DIRIGENTE de ese grupo, y el dirigente no paga la
 * matrícula del grupo que dirige. Verificado contra g.leader_id antes de
 * tocarla; el guard de abajo la señala para que nadie la pase de largo.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const PARTICIPA = `('enrolled','pendiente_de_pago','waitlist','completed','en_revision')`

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows } = await c.query(`
    select se.id, mm.first_name||' '||mm.last_name p, se.status,
      se.enrolled_at::date::text matr, se.dropped_at::date::text baja, se.drop_reason,
      g.name grupo,
      (select count(*)::int from payments py where py.enrollment_id=se.id and py.status='paid') pagados
    from study_enrollments se join members mm on mm.id=se.member_id
    left join study_groups g on g.id=se.group_id
    where se.dropped_at is not null and se.status in ${PARTICIPA}
    order by se.dropped_at desc`)

  console.log(`matrículas activas con rastro de baja: ${rows.length}\n`)
  rows.forEach(r => console.log(`   ${r.p.padEnd(28)} ${r.status} · baja ${r.baja} · ${r.pagados} pago(s) pagado(s)\n        ${r.grupo}\n        motivo que se borra: "${r.drop_reason}"`))

  // Guardia: si alguna NO tiene pago pagado, no encaja con el patrón de
  // reincorporación y hay que mirarla a mano antes de borrarle nada.
  const sinPago = rows.filter(r => r.pagados === 0)
  if (sinPago.length) {
    console.log(`\n   ⚠️  ${sinPago.length} sin ningún pago pagado — revisar el motivo antes de borrarlo:`)
    sinPago.forEach(r => console.log(`      ${r.p}: "${r.drop_reason}"`))
  }

  fs.writeFileSync('data-import/rastro-de-baja-limpiado-2026-09-16.csv',
    [['Persona','Estado','Grupo','Matrícula','Fecha de baja que se borra','Motivo que se borra','Pagos pagados'],
     ...rows.map(r => [r.p, r.status, r.grupo, r.matr, r.baja, r.drop_reason, r.pagados])]
      .map(x => x.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n'))

  const { rowCount } = await c.query(
    `update study_enrollments set dropped_at=null, drop_reason=null where id = any($1)`, [rows.map(r => r.id)])
  console.log(`\nlimpiadas: ${rowCount}`)

  const { rows: [q] } = await c.query(`
    select count(*) filter (where status in ${PARTICIPA})::int activas_con_rastro,
           count(*)::int con_rastro
    from study_enrollments where dropped_at is not null`)
  console.log(`   quedan con dropped_at: ${q.con_rastro} · de esas, activas: ${q.activas_con_rastro} ${q.activas_con_rastro === 0 ? '✓' : '⚠️'}`)
  console.log('   CSV: data-import/rastro-de-baja-limpiado-2026-09-16.csv')
  if (q.activas_con_rastro > 0) { await c.query('rollback'); console.log('❌ Rollback.'); await c.end(); return }

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

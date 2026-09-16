/**
 * Arregla el "Nivel 3. Daniella Sánchez R. Junio 2026" y los cobros huérfanos
 * de la auto-matrícula del cierre (2026-09-16). Decisiones confirmadas por TI.
 *
 * 1) BACKFILL de los cobros huérfanos. `autoEnrollApprovedToNextLevel` creaba el
 *    cobro sin study_group_id, sin entity_type y sin description —el de
 *    `enrollMember` sí los pone—, así que nacían sueltos: la pantalla del grupo
 *    no los encontraba y en la lista de pagos salían como una línea de ₡5.000
 *    sin decir de qué. Son 30 en 5 grupos; se reparan los 29 que tienen una
 *    matrícula que los ubique.
 *
 * 2) Los 5 cobros PENDIENTES del grupo pasan a pagados (TI: ya pagaron).
 *
 * 3) JONATHAN VALVERDE CORDOBA. El cierre del N2 lo registró "reprobado: Se
 *    retiró del estudio por tema laboral" y TI confirma que sí aprobó: se
 *    corrige el N2 a 'aprobado', se le devuelve la matrícula del N3 (que el
 *    barrido de 24 horas le había soltado) y su cobro cancelado pasa a pagado.
 *
 * 4) VICTORIA DELGADO CHAVES. Venía del N2 de Guiselle Trejos, que sigue en
 *    curso. TI confirma que aprobó: se le cierra ese N2 como aprobada, se la
 *    matricula en el N3 y se le crea el cobro de ₡5.000 ya pagado.
 *
 * Los pagos marcados a mano quedan con payment_method='cash': no hay
 * comprobante y decir 'comprobante' sería afirmar un documento que no existe.
 *
 * Con --aplicar escribe; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const N3        = 'ca5ea95b-ac49-46ec-a631-f2d1632d6cae'
const N3_PLAN   = '3db782b8-513c-48d8-89b9-adbbbc39aefb'
const N2_DANI   = 'a3570184-300b-4836-9935-76aba5de1127'
const JONATHAN  = '2a156c86-a028-451c-b50a-2fc720a289cb'
const J_ENR_N2  = 'e79bd187-5d9a-43cc-92a8-aa46879273f9'
const J_ENR_N3  = '28ea534f-1124-4384-b74d-c2d7cb80c5c8'
const J_PAGO    = 'e73e6d79-c6ab-46e7-8ea8-d4f882e98c35'
const VICTORIA  = '0552f084-3f0d-4b51-812b-f96305676ebb'
const V_ENR_N2  = '88270d58-0289-4e91-9c5c-50a925cd027a'
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    // ── 1. Backfill de los cobros huérfanos ────────────────────────────────
    const bf = await c.query(`
      update payments pa
         set study_group_id = e.group_id,
             entity_type    = 'study_group',
             description    = 'Matrícula · ' || pl.name,
             updated_at     = now()
        from study_enrollments e
        join study_groups g on g.id = e.group_id
        join study_plans  pl on pl.id = g.plan_id
       where pa.enrollment_id = e.id
         and pa.concept = 'matricula'
         and pa.study_group_id is null
      returning pa.id`)
    console.log(`1) cobros huérfanos reparados: ${bf.rowCount}`)
    const quedan = await c.query(`select count(*) n from payments where concept='matricula' and study_group_id is null`)
    console.log(`   quedan sin ubicar (sin matrícula detrás): ${quedan.rows[0].n}`)

    // ── 2. Los pendientes del grupo pasan a pagados ────────────────────────
    const pag = await c.query(`
      update payments set status='paid', review_status='aprobado', payment_method='cash',
             paid_at=now(), reviewed_at=now(), updated_at=now()
       where study_group_id=$1 and concept='matricula' and status='pending'
      returning member_id`, [N3])
    console.log(`2) cobros pendientes marcados como pagados: ${pag.rowCount}`)

    // ── 3. Jonathan ────────────────────────────────────────────────────────
    const j1 = await c.query(`
      update study_enrollments set notes='aprobado', updated_at=now()
       where id=$1 and group_id=$2 and notes like 'reprobado:%' returning id`, [J_ENR_N2, N2_DANI])
    if (j1.rowCount !== 1) throw new Error('GUARDA Jonathan: su N2 no estaba marcado reprobado')
    const j2 = await c.query(`
      update study_enrollments set status='enrolled', dropped_at=null, drop_reason=null,
             plan_id=$3, updated_at=now()
       where id=$1 and group_id=$2 returning id`, [J_ENR_N3, N3, N3_PLAN])
    if (j2.rowCount !== 1) throw new Error('GUARDA Jonathan: no encontré su matrícula del N3')
    const j3 = await c.query(`
      update payments set status='paid', review_status='aprobado', payment_method='cash',
             paid_at=now(), reviewed_at=now(), updated_at=now()
       where id=$1 and status='cancelado' returning id`, [J_PAGO])
    if (j3.rowCount !== 1) throw new Error('GUARDA Jonathan: su cobro no estaba cancelado')
    console.log('3) Jonathan: N2 a aprobado, matrícula del N3 restaurada, cobro pagado')

    // ── 4. Victoria ────────────────────────────────────────────────────────
    const v1 = await c.query(`
      update study_enrollments set status='completed', notes='aprobado', completed_at=now(), updated_at=now()
       where id=$1 and member_id=$2 and status='enrolled' returning id`, [V_ENR_N2, VICTORIA])
    if (v1.rowCount !== 1) throw new Error('GUARDA Victoria: su N2 no estaba en enrolled')
    const v2 = await c.query(`
      insert into study_enrollments (member_id, group_id, plan_id, status, enrolled_at, notes)
      values ($1,$2,$3,'enrolled', now(), null)
      on conflict (group_id, member_id) do update set status='enrolled', dropped_at=null, drop_reason=null
      returning id`, [VICTORIA, N3, N3_PLAN])
    const vEnr = v2.rows[0].id
    await c.query(`
      insert into payments (member_id, amount, currency, payment_method, concept, enrollment_id,
                            study_group_id, entity_type, status, review_status, paid_at, reviewed_at,
                            payment_date, description)
      values ($1, 5000, 'CRC', 'cash', 'matricula', $2, $3, 'study_group', 'paid', 'aprobado',
              now(), now(), current_date, 'Matrícula · Nivel 3')`, [VICTORIA, vEnr, N3])
    console.log('4) Victoria: N2 cerrado como aprobada, matriculada en el N3 con su cobro pagado')

    // ── Verificación ───────────────────────────────────────────────────────
    const fin = await c.query(`
      select m.first_name||' '||m.last_name as persona, e.status as matricula,
             pa.amount, pa.status as pago, pa.review_status, pa.study_group_id is not null as ubicado
      from study_enrollments e join members m on m.id=e.member_id
        left join payments pa on pa.enrollment_id=e.id and pa.concept='matricula'
      where e.group_id=$1 order by m.first_name`, [N3])
    console.log(`\n=== EL GRUPO AL FINAL (${fin.rowCount}) ===`)
    fin.rows.forEach(x => console.log(`  ${x.persona.padEnd(30)} ${String(x.matricula).padEnd(10)} ₡${Number(x.amount ?? 0)} ${x.pago ?? 'SIN PAGO'}/${x.review_status ?? '—'} ubicado=${x.ubicado}`))
    const malos = fin.rows.filter(x => x.matricula !== 'enrolled' || x.pago !== 'paid' || !x.ubicado)
    if (malos.length) throw new Error(`GUARDA: ${malos.length} fila(s) no quedaron como se esperaba`)

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()

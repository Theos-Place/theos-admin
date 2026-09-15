/**
 * Familia Angulo Jiménez · devolverle a Steven su ID de CCB y dejar UNA Karen.
 *   npx tsx --env-file=.env.local scripts/karen-steven-2026-09-15/arreglar.cjs [--aplicar]
 *
 * QUÉ PASÓ. La ficha duplicada de Karen se quedó con el external_id 19437, que
 * es el de Steven, y Steven quedó con external_id NULL — invisible para
 * cualquier cruce contra CCB. Viene de junio: esa ficha es Titular de la
 * familia desde el 8 de junio. El import de familias del 15-set lo hizo
 * visible al sumar a la segunda Karen como Cónyuge.
 *
 * Que las dos Karen son la misma persona está probado: hicieron check-in al
 * MISMO evento el mismo día, el 6 y el 13 de setiembre. La asistencia se contó
 * doble.
 *
 * Confirmado por el usuario (15-set): fecha de nacimiento 1986-02-20 y correo
 * tita_solisj@hotmail.com, que es con el que entra al sistema.
 *
 * ORDEN. Los external_id se liberan ANTES de reasignarlos: la columna no tiene
 * único pero dos fichas con el mismo id rompen member_por_external_id, que
 * elige por "ficha viva" y quedaría con dos candidatas vivas.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')

const NACIMIENTO_REAL = '1986-02-20'
const CORREO_REAL = 'tita_solisj@hotmail.com'

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const uno = async (sql, p) => (await c.query(sql, p)).rows[0]
  // Principal: la ficha cuya cuenta se USA para entrar. Misma regla que la
  // pantalla de fusión — mover a alguien a una ficha con la que nunca entró lo
  // deja sin acceso (pasó con Ximena el 14-set).
  const karenViva = await uno(`select id, first_name||' '||last_name p, birth_date::text nac from members where external_id='19437'`)
  const karenDup  = await uno(`select id, first_name||' '||last_name p, birth_date::text nac from members where external_id='19438'`)
  const steven    = await uno(`select id, first_name||' '||last_name p, external_id from members where cedula_normalized='112740191'`)
  console.log(`Karen principal (con la cuenta que usa): ${karenViva.p}  nac=${karenViva.nac}`)
  console.log(`Karen duplicada:                         ${karenDup.p}  nac=${karenDup.nac}`)
  console.log(`Steven:                                  ${steven.p}  ext=${steven.external_id ?? 'NULL'}\n`)

  // 1-2 · Los external_id a su dueño.
  await c.query(`update members set external_id=null, updated_at=now() where id in ($1,$2)`, [karenViva.id, karenDup.id])
  await c.query(`update members set external_id='19437', updated_at=now() where id=$1`, [steven.id])
  await c.query(`update members set external_id='19438', updated_at=now() where id=$1`, [karenViva.id])
  console.log('1) external_id 19437 → Steven · 19438 → Karen')

  // 3 · Fusionar la duplicada dentro de la principal, con los datos que el
  //     usuario confirmó. La fecha buena estaba en la ficha duplicada.
  await c.query(`select merge_members_resuelto($1,$2,$3::jsonb,null)`,
    [karenViva.id, karenDup.id, JSON.stringify({ birth_date: NACIMIENTO_REAL, email: CORREO_REAL })])
  console.log('2) fusionadas las dos fichas de Karen')

  // 4 · La familia: Steven Titular, Karen Cónyuge.
  const fam = await uno(`select family_unit_id id from family_members where member_id=$1`, [karenViva.id])
  await c.query(`insert into family_members (family_unit_id, member_id, relation) values ($1,$2,'Titular')
                 on conflict (family_unit_id, member_id) do update set relation='Titular'`, [fam.id, steven.id])
  await c.query(`update family_members set relation='Cónyuge' where family_unit_id=$1 and member_id=$2`, [fam.id, karenViva.id])
  console.log('3) familia: Steven Titular, Karen Cónyuge')

  console.log('\n── CÓMO QUEDA:')
  const { rows: fin } = await c.query(`
    select m.first_name||' '||m.last_name p, m.external_id ext, m.cedula, m.email, m.birth_date::text nac,
           fm.relation, m.auth_user_id is not null cuenta,
           (select count(*)::int from event_checkins e where e.member_id=m.id) checkins
    from family_members fm join members m on m.id=fm.member_id
    where fm.family_unit_id=$1 order by fm.relation, 1`, [fam.id])
  fin.forEach(r => console.log(`   ${r.relation.padEnd(8)} ${r.p.padEnd(28)} ext=${r.ext ?? '—'} céd=${r.cedula ?? '—'} nac=${r.nac ?? '—'} cuenta=${r.cuenta} ${r.checkins} check-ins`))

  // Guardias.
  const dupExt = await uno(`select count(*)::int n from (select external_id from members where external_id in ('19437','19438') group by 1 having count(*)>1) x`)
  const karenes = await uno(`select count(*)::int n from members where search_text ilike '%karen%' and search_text ilike '%solis jimenez%' and is_active`)
  const res19437 = await uno(`select m.first_name||' '||m.last_name p from members m where m.id = member_por_external_id('19437')`)
  const res19438 = await uno(`select m.first_name||' '||m.last_name p from members m where m.id = member_por_external_id('19438')`)
  console.log(`\n   external_id repetidos: ${dupExt.n} ${dupExt.n===0?'✓':'⚠️'}`)
  console.log(`   Karen Solís Jiménez activas: ${karenes.n} ${karenes.n===1?'✓':'⚠️'}`)
  console.log(`   19437 resuelve a: ${res19437?.p}`)
  console.log(`   19438 resuelve a: ${res19438?.p}`)
  if (dupExt.n > 0 || karenes.n !== 1) { await c.query('rollback'); console.log('\n❌ Rollback.'); await c.end(); return }

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

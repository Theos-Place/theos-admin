/**
 * Camila Sanabria Lopez se creó dos veces; «Camilia» es el error.
 *   npx tsx --env-file=.env.local scripts/dat8-2026-09-15/fusionar-camila.cjs [--aplicar]
 *
 * Las dos fichas tienen la MISMA fecha de nacimiento (2022-03-15), se crearon
 * el mismo día y cada una trae un external_id de CCB. Confirmado por el
 * usuario: es una sola niña.
 *
 * Principal la que dice «Camila» (ext 25014): tiene el nombre bien escrito y ya
 * está vinculada a la familia de Cristel López. La duplicada aporta un check-in
 * de otra fecha, así que la fusión SUMA asistencia en vez de deduplicarla —
 * comprobado antes de correr, que es lo que faltó con Steven Angulo.
 *
 * El correo de la duplicada se quita ANTES de fusionar: es
 * cristellopeztorres@gmail.com, o sea el de la mamá. El merge rellena los
 * huecos del principal con lo del duplicado, así que sin quitarlo la niña
 * heredaría el correo prestado que justamente estamos sacando.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const PRINCIPAL = '25014'   // Camila  — nombre correcto, ya en la familia
const DUPLICADA = '24964'   // Camilia — el error

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')
  const uno = async (s, p) => (await c.query(s, p)).rows[0]

  const a = await uno(`select id, first_name||' '||last_name p, birth_date::text nac, email from members where external_id=$1`, [PRINCIPAL])
  const b = await uno(`select id, first_name||' '||last_name p, birth_date::text nac, email from members where external_id=$1`, [DUPLICADA])
  console.log(`principal: ${a.p} (${a.nac}) · ${a.email ?? 'sin correo'}`)
  console.log(`duplicada: ${b.p} (${b.nac}) · ${b.email ?? 'sin correo'}\n`)
  if (a.nac !== b.nac) throw new Error('las fechas de nacimiento no coinciden — abortar')

  // ¿La fusión suma o deduplica? Con Steven, los check-ins del duplicado eran
  // de OTRA persona y el dedup los borró. Acá hay que ver que sumen.
  const ci = await uno(`
    select (select count(*)::int from event_checkins where member_id=$1) a,
           (select count(*)::int from event_checkins where member_id=$2) b,
           (select count(distinct event_id)::int from event_checkins where member_id in ($1,$2)) union_eventos`,
    [a.id, b.id])
  console.log(`check-ins: principal ${ci.a} · duplicada ${ci.b} · eventos distintos entre las dos ${ci.union_eventos}`)
  if (ci.union_eventos !== ci.a + ci.b) console.log('   (hay eventos repetidos: la fusión los va a deduplicar, y está bien)')

  // El correo prestado, fuera antes de fusionar.
  await c.query(`update members set email=null, updated_at=now() where id=$1`, [b.id])
  await c.query(`select merge_members_resuelto($1,$2,'{}'::jsonb,null)`, [a.id, b.id])

  const fin = await uno(`
    select m.first_name||' '||m.last_name p, m.external_id, m.external_id_fusionados fus, m.email,
      m.birth_date::text nac,
      (select count(*)::int from event_checkins e where e.member_id=m.id) checkins,
      (select fu.name from family_members fm join family_units fu on fu.id=fm.family_unit_id where fm.member_id=m.id) familia
    from members m where m.id=$1`, [a.id])
  console.log(`\nCÓMO QUEDA:\n   ${fin.p} ext=${fin.external_id} fusionados=${JSON.stringify(fin.fus)}`)
  console.log(`   nac ${fin.nac} · ${fin.checkins} check-ins · familia «${fin.familia}» · correo: ${fin.email ?? '(ninguno, el contacto es el de la mamá)'}`)

  const q = await uno(`select count(*)::int n from members where search_text ilike '%sanabria lopez%' and is_active`)
  console.log(`   fichas activas con ese apellido: ${q.n} ${q.n === 1 ? '✓' : '⚠️'}`)
  if (fin.checkins !== ci.union_eventos) { await c.query('rollback'); console.log('\n❌ Rollback: se perdió asistencia.'); await c.end(); return }

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

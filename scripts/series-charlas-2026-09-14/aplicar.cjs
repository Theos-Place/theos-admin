/**
 * Aplica el mapeo. Dry run por defecto.
 *   node scripts/series-charlas-2026-09-14/aplicar.cjs [--aplicar]
 *
 * Tres pasos, en este orden:
 *  1. Fusionar las dos sedes que se llaman "Sede Pedregal Miércoles".
 *  2. Ponerle sede_id a los eventos históricos.
 *  3. Arreglar charla_sede_code, que hoy manda los del miércoles a la sede de
 *     los martes y tres charlas de Pedregal a una sede inactiva. De eso depende
 *     la sede automática de cada miembro (refresh_member_sedes) y la
 *     elegibilidad, no solo el reporte.
 *
 * NADA de tocar check-ins: siguen colgando de sus eventos.
 */
const L = require('../madre-2026-09/lib.cjs')
const { MAPEO, YOUTH_APARTE, CERRADAS, SIN_DECIDIR, FUSION_DE_SEDES } = require('./mapeo.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const q = async (s, p = []) => (await c.query(s, p)).rows

  console.log('══ 1 · LAS DOS SEDES QUE SE LLAMAN IGUAL')
  const sedes = await q(`select code, id, name,
      (select count(*) from members m where m.sede_id=s.id)::int miembros,
      (select count(*) from events e where e.sede_id=s.id)::int eventos
    from sedes s where code = any($1)`, [[FUSION_DE_SEDES.conservar, FUSION_DE_SEDES.retirar]])
  console.table(sedes)
  const conservar = sedes.find(s => s.code === FUSION_DE_SEDES.conservar)
  const retirar = sedes.find(s => s.code === FUSION_DE_SEDES.retirar)

  console.log('\n══ 2 · SEDE_ID A LOS EVENTOS HISTÓRICOS')
  const plan = []
  for (const [titulo, code] of Object.entries(MAPEO)) {
    const [x] = await q(`select count(*)::int eventos,
        count(*) filter (where e.sede_id is null)::int sin_sede,
        (select count(*) from event_checkins k join events e2 on e2.id=k.event_id where e2.title=$1)::int checkins
      from events e where e.title=$1 and e.event_type='charla'`, [titulo])
    const [s] = await q(`select id, name from sedes where code=$1`, [code])
    if (!s) { console.log(`  ⚠️  ${titulo}: la sede ${code} no existe`); continue }
    plan.push({ titulo, eventos: x.eventos, sin_sede: x.sin_sede, checkins: x.checkins, hacia: s.name, code })
  }
  console.table(plan)
  console.log(`total de eventos a etiquetar: ${plan.reduce((a, p) => a + p.sin_sede, 0)}`)
  console.log(`youth, aparte en el reporte:  ${Object.keys(YOUTH_APARTE).join(', ')}`)
  console.log(`cerradas, no se tocan:        ${CERRADAS.join(', ')}`)
  console.log(`sin decisión, no se tocan:    ${SIN_DECIDIR.join(', ')}`)

  console.log('\n══ 3 · CÓMO QUEDARÍA EL REPORTE (agrupa por nombre de sede)')
  const antes = await q(`select coalesce(s.name, e.title) serie, count(k.*)::int checkins
    from events e left join sedes s on s.id=e.sede_id
    join event_checkins k on k.event_id=e.id
    where e.event_type='charla' group by 1 order by 2 desc limit 8`)
  console.log('  ANTES (las series cortadas):'); console.table(antes)

  await c.query('begin')

  // 1) Fusión de sedes.
  let movidos = 0
  if (conservar && retirar) {
    movidos = (await c.query(`update members set sede_id=$1 where sede_id=$2`, [conservar.id, retirar.id])).rowCount
    await c.query(`update events set sede_id=$1 where sede_id=$2`, [conservar.id, retirar.id])
    await c.query(`update sedes set is_active=false, name=name||' (código viejo)' where id=$1`, [retirar.id])
  }

  // 2) sede_id a los históricos.
  let etiquetados = 0
  for (const p of plan) {
    const { rowCount } = await c.query(
      `update events set sede_id=(select id from sedes where code=$2), updated_at=now()
       where title=$1 and event_type='charla' and sede_id is null`, [p.titulo, p.code])
    etiquetados += rowCount
  }
  console.log(`\nmiembros movidos de sede: ${movidos} · eventos etiquetados: ${etiquetados}`)

  const despues = await q(`select coalesce(s.name, e.title) serie, count(k.*)::int checkins,
      to_char(min(k.checked_in_at at time zone 'America/Costa_Rica'),'YYYY-MM') desde,
      to_char(max(k.checked_in_at at time zone 'America/Costa_Rica'),'YYYY-MM') hasta
    from events e left join sedes s on s.id=e.sede_id
    join event_checkins k on k.event_id=e.id
    where e.event_type='charla' group by 1 order by 2 desc limit 10`)
  console.log('  DESPUÉS (unificadas):'); console.table(despues)

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback) — no se tocó nada.') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

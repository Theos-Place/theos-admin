/**
 * PRODUCCIÓN TÉCNICA · Devolverle la jerarquía que CCB sí tiene.
 *   npx tsx --env-file=.env.local scripts/servidores-2026-09-15/produccion-tecnica.cjs [--aplicar]
 *
 * El subcomité quedó aplanado en un solo puesto, «Colaborador PT sedes»: no
 * había ni un Coordinador ni un Encargado activo en toda el área, mientras CCB
 * tiene seis personas con rango. Esto crea el puesto que faltaba y mueve a esas
 * seis del puesto de colaborador al que les corresponde.
 *
 * Decisiones del usuario (15-set):
 *  · «Coordinador Sede» va SOLO bajo el subcomité, no abierto por sede. La sede
 *    de cada coordinador no queda registrada — hoy no hay dónde: base_area_id
 *    está sin usar (0 de 361 puestos) y las sedes cuelgan de «Sedes», no de
 *    Producción Técnica. Mismo patrón que «Coordinador Oración Sede».
 *  · Sus filas de «Colaborador PT sedes» se REEMPLAZAN por lo que dice CCB: en
 *    CCB cada uno aparece una sola vez y con rango, así que la de colaborador
 *    se cierra. Nada se borra — status='inactive' + end_date, que es lo que el
 *    flujo de reintegro sabe deshacer.
 *  · Solo se tocan filas de Producción Técnica. Lo de afuera no se mira: el
 *    «Dirigente CR» de Diego tampoco está en este CSV y no por eso se cierra.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')

const SUBCOMITE = 'SubComité Producción Técnica'
// external_id → título nuevo dentro del subcomité (los nombres son los que pidió
// el usuario, no los de CCB: CCB lleva la sede pegada al título y acá la sede no
// se guarda).
const RANGO = {
  '16348': 'Coordinador Sede',  // Diego Madriz Arce        (CCB: Coordinador Prod.Técnica Cartago)
  '10191': 'Coordinador Sede',  // Jose Manuel Avendaño     (CCB: Coordinador Prod.Técnica Pedregal M)
  '18890': 'Encargado',         // Jose Pablo Ramírez       (CCB: Encargado)
  '4689':  'Coordinador Sede',  // Luis Diego Campos        (CCB: Coordinador Prod.Técnica Alajuela)
  '13620': 'Coordinador Sede',  // Mercedes Rojas Conejo    (CCB: Coordinador Prod.Técnica Antares)
  '2593':  'Coordinador Sede',  // Roberto Barquero         (CCB: Coordinador Prod.Técnica Liberia)
}
/** Lo que se les cierra: su puesto de colaborador de PT, esté donde esté. */
const COLABORADOR_PT = 'Colaborador PT sedes'

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const ext = Object.keys(RANGO)
  const { rows: gente } = await c.query(
    `select id, external_id, first_name||' '||last_name persona from members where external_id = any($1)`, [ext])
  const faltan = ext.filter(e => !gente.some(g => g.external_id === e))
  if (faltan.length) throw new Error(`sin ficha: ${faltan.join(', ')}`)

  const { rows: [area] } = await c.query(`select id from areas where name = $1`, [SUBCOMITE])
  if (!area) throw new Error(`no existe el área «${SUBCOMITE}»`)

  // 1. El puesto que falta. «Encargado» ya existe en el subcomité (activo, sin
  //    gente); «Coordinador Sede» hay que crearlo.
  const titulos = [...new Set(Object.values(RANGO))]
  const puesto = {}
  for (const t of titulos) {
    const { rows: [ya] } = await c.query(
      `select id, is_active from service_positions where area_id = $1 and title = $2`, [area.id, t])
    if (ya) {
      if (!ya.is_active) await c.query(`update service_positions set is_active=true, updated_at=now() where id=$1`, [ya.id])
      puesto[t] = ya.id
      console.log(`puesto «${t}»: ya existía${ya.is_active ? '' : ' (reactivado)'}`)
    } else {
      const cupo = Object.values(RANGO).filter(x => x === t).length
      const { rows: [nuevo] } = await c.query(
        `insert into service_positions (area_id, title, is_active, quantity, max_volunteers)
         values ($1, $2, true, $3, $3) returning id`, [area.id, t, cupo])
      puesto[t] = nuevo.id
      console.log(`puesto «${t}»: CREADO (cupo ${cupo})`)
    }
  }

  // 2. Cerrar el puesto de colaborador de PT de estas seis personas.
  const { rows: cerradas } = await c.query(`
    update volunteers v set status='inactive', end_date=coalesce(v.end_date, current_date), updated_at=now()
    from service_positions sp, areas a
    where sp.id = v.position_id and a.id = sp.area_id
      and v.member_id = any($1) and v.status='active' and sp.title = $2
    returning v.id, v.member_id, a.name comite`, [gente.map(g => g.id), COLABORADOR_PT])
  console.log(`\nfilas de «${COLABORADOR_PT}» cerradas: ${cerradas.length}`)
  for (const r of cerradas) console.log(`   ${gente.find(g => g.id === r.member_id).persona} · ${r.comite}`)

  // 3. Darles el puesto con rango. El índice único (member_id, position_id)
  //    impide duplicar: si ya tuvieran la fila, se reactiva en vez de insertar.
  console.log('\nrango asignado:')
  for (const g of gente) {
    const t = RANGO[g.external_id]
    const { rows: [r] } = await c.query(`
      insert into volunteers (member_id, position_id, status, start_date)
      values ($1, $2, 'active', current_date)
      on conflict (member_id, position_id)
        do update set status='active', end_date=null, updated_at=now()
      returning (xmax = 0) as insertado`, [g.id, puesto[t]])
    console.log(`   ${g.persona.padEnd(30)} «${t}»  ${r.insertado ? 'nueva' : 'reactivada'}`)
  }

  const { rows: resumen } = await c.query(`
    select sp.title, count(*) filter (where v.status='active')::int act
    from service_positions sp join areas a on a.id = sp.area_id
    left join volunteers v on v.position_id = sp.id
    where a.name = $1 and sp.is_active group by 1 having count(*) filter (where v.status='active') > 0 order by 1`, [SUBCOMITE])
  console.log(`\nCÓMO QUEDA ${SUBCOMITE}:`)
  resumen.forEach(r => console.log(`   «${r.title}» → ${r.act} activos`))

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

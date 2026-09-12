/**
 * ETAPA 5c · Puestos que quedaron en el comité equivocado.
 *   node scripts/madre-2026-09/etapa5c-puestos-en-comite-equivocado.cjs [--aplicar]
 *
 * El madre resolvió algunos genéricos con un fallback al comité más parecido y
 * eso creó puestos donde no van. Ya se corrigieron dos así (Matrimonios y los
 * "Coordinador Oración <sede>"); acá van los que quedaron:
 *
 *  1. «Encargado Experiencia» dentro de SubComité Producción Técnica. El CCB
 *     decía "Encargado de Expereriencia" (con el typo) y el match difuso lo
 *     dejó en Prod. Técnica. Es el encargado del Comité Experiencia — el madre
 *     mismo pone ese puesto en Experiencia. Se mueve la persona y se borra el
 *     puesto vacío.
 *
 *  2. «Encargado Dirigentes» dentro de Comité Dirigentes Administrativo. Mismo
 *     caso que Matrimonios: el canon no tiene "Encargado Dirigentes
 *     Administrativo", así que el fallback lo mandó al de Dirigentes. Se crea el
 *     puesto propio, siguiendo la decisión que el usuario ya tomó para
 *     Matrimonios (Encargado + comité).
 *
 *  3. Los «Coordinador Prod.Técnica <sede>» que sobrevivieron. La nota del madre
 *     lo deja decidido: "en Prod. Técnica los coordinadores/encargados de CCB
 *     también van como Colaborador PT sedes". Solo se migraron los que tenían
 *     fila en la hoja Personas; estos quedaron sueltos.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const uno = async (q, p) => (await c.query(q, p)).rows[0]
  const puesto = (comite, title) => uno(
    `select sp.id, (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int act
     from service_positions sp join areas a on a.id=sp.area_id where a.name=$1 and sp.title=$2 and sp.is_active`, [comite, title])

  await c.query('begin')
  let movidas = 0

  /** Mueve la gente de `de` a `a` respetando la única (member,puesto): al que ya
   *  está en el destino se le REACTIVA esa fila y se le cierra la vieja. */
  const mover = async (deId, aId) => {
    const { rows: choque } = await c.query(
      // SIN filtrar por status: el UPDATE de abajo mueve TODAS las filas, así
      // que una fila inactiva cuyo miembro ya está en el destino también choca
      // con la única (member_id, position_id).
      `select v.id, v.status from volunteers v where v.position_id=$1
        and exists (select 1 from volunteers w where w.position_id=$2 and w.member_id=v.member_id)`, [deId, aId])
    if (choque.length) {
      // Solo se reactiva el destino de quien traía una fila ACTIVA: si la vieja
      // ya estaba inactiva, la persona no estaba sirviendo y no se la revive.
      const activos = choque.filter(x => x.status === 'active').map(x => x.id)
      if (activos.length) {
        await c.query(`update volunteers set status='active', end_date=null, updated_at=now()
          where position_id=$2 and status <> 'active' and member_id in (select member_id from volunteers where id = any($1))`,
          [activos, aId])
      }
      await c.query(`update volunteers set status='inactive', end_date=coalesce(end_date,current_date), updated_at=now() where id = any($1)`,
        [choque.map(x => x.id)])
    }
    const { rowCount } = await c.query(`update volunteers set position_id=$2, updated_at=now() where position_id=$1 and id <> all($3)`,
      [deId, aId, choque.map(x => x.id)])
    movidas += rowCount + choque.filter(x => x.status === 'active').length
    await c.query(`update service_positions set is_active=false, updated_at=now() where id=$1`, [deId])
  }

  // 1 · Encargado Experiencia
  const malo = await puesto('SubComité Producción Técnica', 'Encargado Experiencia')
  const bueno = await puesto('Comité Experiencia', 'Encargado Experiencia')
  if (malo && bueno) { console.log(`1· «Encargado Experiencia»: ${malo.act} persona(s) de Prod. Técnica → Comité Experiencia (${bueno.act})`); await mover(malo.id, bueno.id) }
  else console.log('1· nada que hacer')

  // 2 · Encargado Dirigentes Administrativo
  const mal2 = await puesto('Comité Dirigentes Administrativo', 'Encargado Dirigentes')
  if (mal2) {
    const { rows: [area] } = await c.query(`select id from areas where name='Comité Dirigentes Administrativo'`)
    const { rows: [nuevo] } = await c.query(
      `insert into service_positions (area_id, title, is_active) values ($1,'Encargado Dirigentes Administrativo',true) returning id`, [area.id])
    console.log(`2· «Encargado Dirigentes» → se crea «Encargado Dirigentes Administrativo» y se mueven ${mal2.act}`)
    await mover(mal2.id, nuevo.id)
  } else console.log('2· nada que hacer')

  // 3 · Coordinador Prod.Técnica <sede> → Colaborador PT sedes
  const { rows: coords } = await c.query(
    `select sp.id, sp.title, (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int act
     from service_positions sp join areas a on a.id=sp.area_id
     where a.name='SubComité Producción Técnica' and sp.is_active and sp.title ilike 'Coordinador Prod%'`)
  const destino = await puesto('SubComité Producción Técnica', 'Colaborador PT sedes')
  console.log(`3· ${coords.length} «Coordinador Prod.Técnica <sede>» → «Colaborador PT sedes»`)
  for (const x of coords) { console.log(`     «${x.title}» (${x.act})`); await mover(x.id, destino.id) }

  // Limpieza: los que quedaron vacíos y sin referencias se borran.
  const { rowCount: borrados } = await c.query(`delete from service_positions sp
    where not sp.is_active and not exists (select 1 from volunteers v where v.position_id=sp.id)
      and not exists (select 1 from member_role_position_grants g where g.position_id=sp.id)
      and not exists (select 1 from vacancies vc where vc.position_id=sp.id)
      and not exists (select 1 from position_requests pr where pr.created_position_id=sp.id)`)

  const { rows: pt } = await c.query(`select sp.title, (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int act
    from service_positions sp join areas a on a.id=sp.area_id where a.name='SubComité Producción Técnica' and sp.is_active order by act desc`)
  console.log(`\nasignaciones movidas: ${movidas}   puestos vacíos borrados: ${borrados}`)
  console.log('SubComité Producción Técnica queda:'); pt.forEach(x => console.log(`   ${String(x.act).padStart(3)}  «${x.title}»`))
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

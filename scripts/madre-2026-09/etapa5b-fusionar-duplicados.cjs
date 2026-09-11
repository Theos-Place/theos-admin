/**
 * ETAPA 5b · Fusionar los puestos que quedaron con el MISMO título dentro de un
 * comité.
 *
 * Bug de la Etapa 2: cuando dos puestos de un comité mapeaban al mismo nombre
 * oficial y NINGUNO se llamaba así todavía, la búsqueda de "gemelo" no
 * encontraba nada y los dos se renombraban por separado. Pasó una vez: Sede
 * Madrid con «Colaborador Audiovisuales» y «Coordinador Audiovisuales», los dos
 * a «Colaborador PT sedes».
 *
 * Se conserva el que tiene MÁS historial y se le mueve la gente del otro.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const { rows: grupos } = await c.query(`select a.name comite, sp.area_id, sp.title, count(*)::int n
    from service_positions sp join areas a on a.id=sp.area_id
    where sp.is_active and a.name not like '[prueba]%' group by 1,2,3 having count(*)>1`)
  console.log(`títulos repetidos dentro de un comité: ${grupos.length}`)
  await c.query('begin')
  let fus = 0, movidos = 0, choques = 0
  for (const g of grupos) {
    const { rows: ps } = await c.query(`select sp.id,
        (select count(*) from volunteers v where v.position_id=sp.id)::int tot,
        (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int act
      from service_positions sp where sp.area_id=$1 and sp.title=$2 and sp.is_active
      order by tot desc, sp.created_at asc`, [g.area_id, g.title])
    const [queda, ...sobran] = ps
    console.log(`\n  ${g.comite} «${g.title}»: se conserva el de ${queda.tot} filas; se fusionan ${sobran.map(s=>s.tot+' filas').join(', ')}`)
    for (const s of sobran) {
      const { rows: choque } = await c.query(`select v.id from volunteers v where v.position_id=$1
          and exists (select 1 from volunteers w where w.position_id=$2 and w.member_id=v.member_id)`, [s.id, queda.id])
      if (choque.length) {
        // El destino puede tener la fila INACTIVA: si solo se inactiva la del
        // puesto viejo, la persona se queda sin ninguna activa y PIERDE la
        // asignación. Pasó con 5 de Sede Madrid. Se reactiva el destino primero.
        await c.query(`update volunteers set status='active', end_date=null, updated_at=now()
                           where position_id=$2 and status <> 'active'
                             and member_id in (select member_id from volunteers where id = any($1))`,
          [choque.map(x => x.id), queda.id])
        await c.query(`update volunteers set status='inactive', end_date=coalesce(end_date, current_date), updated_at=now()
                           where id = any($1)`, [choque.map(x => x.id)])
        choques += choque.length
      }
      const { rowCount } = await c.query(`update volunteers set position_id=$2, updated_at=now() where position_id=$1 and id <> all($3)`,
        [s.id, queda.id, choque.map(x=>x.id)])
      movidos += rowCount
      await c.query(`update service_positions set is_active=false, updated_at=now() where id=$1`, [s.id])
      fus++
    }
  }
  const { rows: [q] } = await c.query(`select count(*)::int n from (select sp.area_id, sp.title from service_positions sp
      join areas a on a.id=sp.area_id where sp.is_active and a.name not like '[prueba]%'
      group by 1,2 having count(*)>1) t`)
  console.log(`\nfusionados: ${fus}   asignaciones movidas: ${movidos}   (${choques} ya estaban en el destino)`)
  console.log(`títulos repetidos que quedan: ${q.n}`)
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

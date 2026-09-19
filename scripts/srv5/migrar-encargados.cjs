/**
 * SRV-5 · Los encargados que solo vivían en `areas.leader_id` reciben su puesto.
 *
 * Decisión del usuario 2026-09-18: la fuente única pasa a ser el puesto, y
 * NADIE pierde nada — donde las dos fuentes decían personas distintas, quedan
 * las dos como encargadas.
 *
 * Corre en una transacción. Sin APLICAR=1 hace ROLLBACK y solo reporta.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    // Todo comité activo cuyo leader_id no tenga ya un puesto de encargado ahí.
    const pend = await c.query(`
      select a.id area_id, a.name comite, a.leader_id,
             m.first_name||' '||m.last_name persona,
             a.parent_id, pa.name padre,
             (select sp.id from service_positions sp
               where sp.area_id = a.id and sp.is_active
                 and lower(unaccent(sp.title)) ~ '^encargado'
                 and lower(unaccent(sp.title)) !~ '^encargado +(de +)?logistica'
               order by (select count(*) from volunteers v where v.position_id=sp.id and v.status='active') desc,
                        sp.created_at
               limit 1) puesto_id
      from areas a
      join members m on m.id = a.leader_id
      left join areas pa on pa.id = a.parent_id
      where a.area_type='committee' and a.is_active
        and not exists (
          select 1 from service_positions sp
          join volunteers v on v.position_id = sp.id and v.status='active' and v.member_id = a.leader_id
          where sp.area_id = a.id and sp.is_active
            and lower(unaccent(sp.title)) ~ '^encargado'
            and lower(unaccent(sp.title)) !~ '^encargado +(de +)?logistica')
      order by a.name`)

    console.log(`Encargados por leader_id sin puesto propio: ${pend.rowCount}`)
    for (const r of pend.rows) {
      const esSede = (r.padre || '').toLowerCase() === 'sedes' || /^sede /i.test(r.comite)
      let puestoId = r.puesto_id
      if (!puestoId) {
        const titulo = esSede ? 'Encargado Sede' : 'Encargado Comité'
        const ins = await c.query(
          `insert into service_positions (area_id, title, quantity, max_volunteers, is_active)
           values ($1,$2,1,1,true) returning id`, [r.area_id, titulo])
        puestoId = ins.rows[0].id
        console.log(`  ${r.comite}: puesto "${titulo}" CREADO`)
      }
      await c.query(
        `insert into volunteers (position_id, member_id, status, start_date)
         values ($1,$2,'active', (now() at time zone 'America/Costa_Rica')::date)
         on conflict (member_id, position_id)
         do update set status='active', end_date=null`, [puestoId, r.leader_id])
      // Que el cupo del puesto no quede por debajo de lo que realmente hay.
      await c.query(
        `update service_positions sp set max_volunteers = greatest(coalesce(sp.max_volunteers,1),
           (select count(*) from volunteers v where v.position_id=sp.id and v.status='active'))
         where sp.id = $1`, [puestoId])
      // El rol lider_comite lo dan los comités que NO son de sede (regla de
      // position-roles, decisión 2026-09-11). Mismo RPC que usa la app.
      if (!esSede) await c.query(`select grant_position_role($1,'lider_comite',$2)`, [r.leader_id, puestoId])
      console.log(`  ${r.comite}: ${r.persona} → encargado${esSede ? ' (sede: sin lider_comite)' : ' + lider_comite'}`)
    }

    const verif = await c.query(`
      select a.name comite, string_agg(m.first_name||' '||m.last_name, ' | ' order by m.first_name) encargados
      from areas a
      join service_positions sp on sp.area_id=a.id and sp.is_active
        and lower(unaccent(sp.title)) ~ '^encargado'
        and lower(unaccent(sp.title)) !~ '^encargado +(de +)?logistica'
      join volunteers v on v.position_id=sp.id and v.status='active'
      join members m on m.id=v.member_id
      where a.area_type='committee' and a.is_active
        and a.name in ('Comité Ayuda Social','Comité Contabilidad','Sede Madrid Home')
      group by 1 order by 1`)
    console.log('\nVerificación:'); console.table(verif.rows)

    const huerf = await c.query(`
      select count(*)::int n from areas a where a.area_type='committee' and a.is_active and a.leader_id is not null
        and not exists (select 1 from service_positions sp join volunteers v on v.position_id=sp.id
          and v.status='active' and v.member_id=a.leader_id
          where sp.area_id=a.id and sp.is_active and lower(unaccent(sp.title)) ~ '^encargado'
            and lower(unaccent(sp.title)) !~ '^encargado +(de +)?logistica')`)
    console.log(`leader_id sin puesto que lo respalde (debe ser 0): ${huerf.rows[0].n}`)

    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? '\nAPLICADO' : '\nROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

/**
 * Corrección 2026-09-18: la encargada real de Comité Ayuda Social es Carolina
 * Salas MENA, no Salas Amador (confirmado por el usuario).
 *
 * `areas.leader_id` apuntaba a Amador y la migración de SRV-5 le dio el puesto
 * para no quitarle nada a nadie. Era el campo el que estaba mal. Se revierte
 * EXACTAMENTE lo que agregó esa migración —puesto, respaldo y rol, todos
 * creados hoy— y se limpia el leader_id, que ya no se lee pero seguía diciendo
 * una mentira.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const AMADOR = '01674269-70c0-4afd-8c86-d6447068c4ac'
const PUESTO = 'e115f50c-381b-4c90-aef3-bfc0dd3d1605' // Encargado Comité · Ayuda Social

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    // El RPC es el mismo camino que usa la app al desasignar: quita el respaldo
    // y desactiva el rol solo si ningún otro puesto lo sostiene.
    await c.query(`select revoke_position_role($1,'lider_comite',$2)`, [AMADOR, PUESTO])

    // La fila del puesto y la del rol las creó la migración de hoy y no
    // representan un servicio real: se borran en vez de marcarse inactivas.
    // Dejarlas inactivas diría que sirvió y la dieron de baja, que no pasó.
    const v = await c.query(`delete from volunteers where member_id=$1 and position_id=$2`, [AMADOR, PUESTO])
    const r = await c.query(
      `delete from member_roles where member_id=$1 and role='lider_comite' and granted_at::date = current_date`, [AMADOR])
    console.log(`filas borradas — puesto: ${v.rowCount}, rol: ${r.rowCount}`)

    const a = await c.query(
      `update areas set leader_id = null where name='Comité Ayuda Social' and leader_id=$1`, [AMADOR])
    console.log(`leader_id limpiado: ${a.rowCount}`)

    const enc = await c.query(`
      select m.first_name||' '||m.last_name persona
      from service_positions sp join volunteers v on v.position_id=sp.id and v.status='active'
      join members m on m.id=v.member_id join areas a on a.id=sp.area_id
      where a.name='Comité Ayuda Social' and sp.is_active
        and lower(unaccent(sp.title)) ~ '^encargado' order by 1`)
    console.log('encargados de Ayuda Social:', enc.rows.map(x => x.persona).join(' | ') || '(ninguno)')

    const rol = await c.query(`select role, origen, is_active from member_roles where member_id=$1`, [AMADOR])
    console.log('roles de Amador:', rol.rows.length ? rol.rows : '(ninguno)')

    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

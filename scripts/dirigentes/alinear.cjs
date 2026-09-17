/**
 * Alinea las tres fuentes del estado "dirigente activo" (2026-09-17).
 *
 * El comité manda, con UNA excepción medida: 6 de los 10 que quedarían fuera
 * están dirigiendo un grupo abierto o en curso. Desactivarlos les quitaría el
 * rol mientras dan clase, y además la lectura correcta es la inversa: quien
 * dirige un grupo vivo ES dirigente activo, así que el desactualizado es el
 * comité. A esos se los AGREGA al comité en vez de darlos de baja.
 *
 * Luis Javier Hernández Orozco queda fuera a propósito: está 'en_revision', que
 * es una decisión explícita de la coordinación y el propio `setDirigenteActive`
 * la protege con un guard. No se pisa desde un script.
 *
 * Con --aplicar escribe; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')

const COMITE = `
  select distinct v.member_id from volunteers v
  join service_positions sp on sp.id=v.position_id join areas ar on ar.id=sp.area_id
  where ar.name='Comité Dirigentes' and v.status='active'
    and unaccent(lower(sp.title)) like 'dirigente%'`

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const puesto = await c.query(`select sp.id from service_positions sp join areas ar on ar.id=sp.area_id
      where ar.name='Comité Dirigentes' and sp.title='Dirigente CR'`)
    if (!puesto.rowCount) throw new Error('GUARDA: no encuentro el puesto "Dirigente CR"')
    const PUESTO_CR = puesto.rows[0].id

    // 1) Los del comité que no están activos en dirigentes → activar. Menos los en revisión.
    const alta = await c.query(`
      select m.id, m.first_name||' '||m.last_name nom
      from (${COMITE}) x join members m on m.id=x.member_id
        left join study_leaders sl on sl.member_id=m.id
        left join member_admin_data mad on mad.member_id=m.id
      where (sl.member_id is null or sl.is_active is not true)
        and coalesce(sl.availability_status,'') <> 'en_revision'
        and coalesce(mad.not_recommended_to_lead_studies,false) = false`)
    for (const r of alta.rows) {
      await c.query(`
        insert into study_leaders (member_id, is_active, availability_status, zone_preference, qualified_study_codes)
        values ($1, true, 'available', '{}', '{}')
        on conflict (member_id) do update set is_active = true,
          availability_status = case when study_leaders.availability_status in ('en_pausa','en_revision')
                                     then study_leaders.availability_status else 'available' end`, [r.id])
    }
    console.log(`1) activados en dirigentes (venían del comité): ${alta.rowCount}`)

    // 2) Activos en dirigentes fuera del comité: los que DIRIGEN grupo vivo entran al comité.
    const conGrupo = await c.query(`
      select distinct m.id, m.first_name||' '||m.last_name nom
      from study_leaders sl join members m on m.id=sl.member_id
        join study_groups g on (g.leader_id=m.id or g.co_leader_id=m.id)
      where sl.is_active and m.id not in (${COMITE})
        and g.status in ('en_curso','en_matricula','programado')`)
    for (const r of conGrupo.rows) {
      await c.query(`insert into volunteers (member_id, position_id, status) values ($1,$2,'active')
        on conflict (member_id, position_id) do update set status='active'`, [r.id, PUESTO_CR])
    }
    console.log(`2) agregados al comité (dirigen un grupo vivo): ${conGrupo.rowCount}`)
    conGrupo.rows.forEach(r => console.log(`     ${r.nom}`))

    // 3) El resto, fuera del comité y sin grupo vivo → desactivar.
    const baja = await c.query(`
      select m.id, m.first_name||' '||m.last_name nom from study_leaders sl join members m on m.id=sl.member_id
      where sl.is_active and m.id not in (${COMITE})`)
    for (const r of baja.rows) {
      await c.query(`update study_leaders set is_active=false,
        availability_status = case when availability_status in ('en_pausa','en_revision') then availability_status else 'inactive' end
        where member_id=$1`, [r.id])
    }
    console.log(`3) desactivados (fuera del comité, sin grupo vivo): ${baja.rowCount}`)
    baja.rows.forEach(r => console.log(`     ${r.nom}`))

    // 4) El rol 'dirigente' sigue al comité.
    const rolAlta = await c.query(`
      insert into member_roles (member_id, role, is_active)
      select x.member_id, 'dirigente', true from (${COMITE}) x
      on conflict (member_id, role) do update set is_active = true
      returning member_id`)
    const rolBaja = await c.query(`
      update member_roles set is_active=false
      where role='dirigente' and is_active and member_id not in (${COMITE}) returning member_id`)
    console.log(`4) rol 'dirigente': ${rolAlta.rowCount} asegurados · ${rolBaja.rowCount} revocados`)

    const fin = await c.query(`select
      (select count(*) from (${COMITE}) a) comite,
      (select count(*) from study_leaders where is_active) lista,
      (select count(*) from member_roles where role='dirigente' and is_active) rol`)
    console.log('\n=== LAS TRES FUENTES AL FINAL ===')
    console.log('  ' + JSON.stringify(fin.rows[0]))

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()

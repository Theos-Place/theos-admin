/**
 * Segunda tanda de correcciones de Estudios Bíblicos (28/10/2026, decisión de Floriana).
 *
 *   node scripts/dirigentes-2026-10-28/segunda-tanda.cjs              # dry run
 *   node scripts/dirigentes-2026-10-28/segunda-tanda.cjs --aplicar
 *
 *   1. El grupo «Nivel 4. Marco Acuña y Tatiana Arauz. Octubre 2026» pasa a
 *      Tatiana como dirigente principal, sin codirigente. Marco deja de ser
 *      dirigente: inactivo SIN razón (coordinación la elige), comité y rol
 *      `dirigente` fuera, igual que setDirigenteActive(false).
 *   2. Los cinco que no aprobaron el CDEB: la inscripción al CDEB pasa a
 *      `reprobado` (Antonio, Félix y Milena figuraban «completed»; Marisol ya
 *      estaba; Jose Francisco no tiene inscripción al CDEB y no se inventa)
 *      y se BORRA la ficha de dirigente, como a los cuatro de la primera tanda.
 *
 * Respaldo en docs/correcciones/2026-10-28-dirigentes-segunda-tanda.json y
 * una fila de audit_log por cambio.
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const BACKUP = 'docs/correcciones/2026-10-28-dirigentes-segunda-tanda.json'
const SCRIPT = 'scripts/dirigentes-2026-10-28/segunda-tanda.cjs'
const ETIQUETA = 'Corrección de Estudios Bíblicos (28/10/2026)'
const GRUPO = 'a9180796-4c23-4d43-96cf-857471cba22a'
const MARCO = '45dba1bf-55ba-43f9-ab36-62586593f9a5'
const TATIANA = 'f069b781-5b0f-4cf9-bd19-f2cd8662d729'
const CDEB = [
  { id: 'd3d2fad4-4e86-498c-bcca-2fc8cde071a4', nombre: 'Antonio Buitrago', enr: '6079795c-9f40-4747-a3e4-01bf89a7b0fa' },
  { id: '4fb38e72-9ac7-478d-ad2a-d244ddc1e7b4', nombre: 'Felix Badilla Vargas', enr: '7021f810-961f-4f3f-b0f3-a027542151d1' },
  { id: '7d28a3a4-1085-4f68-9325-83699c8a4292', nombre: 'Milena Halsband', enr: '0e1d3ceb-2309-4f9d-bdd6-f8a5eb480e8f' },
  { id: '55c6645f-482f-470c-b4ee-4f4555eac49a', nombre: 'Marisol Soto Alarcón', enr: '25a20347-a6a4-495d-90be-9affce8d8e4a' },
  { id: 'fa3116d6-b069-4221-b928-b7566cfd0ad7', nombre: 'Jose Francisco Sanchez Navarro', enr: null },
]

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query("set statement_timeout = '120s'")
  const { rows: [g] } = await c.query(`select * from study_groups where id=$1`, [GRUPO])
  if (!g || g.leader_id !== MARCO || g.co_leader_id !== TATIANA || g.status !== 'en_curso') throw new Error('el grupo no está como se midió')
  const { rows: [slMarco] } = await c.query(`select * from study_leaders where member_id=$1`, [MARCO])
  if (slMarco.estado_base !== 'activo') throw new Error('Marco ya no está activo')
  const { rows: puestos } = await c.query(`select sp.id from service_positions sp join areas a on a.id=sp.area_id where a.name='Comité Dirigentes' and sp.title ilike 'dirigente%'`)
  const puestosDirigente = puestos.map(p => p.id)
  const { rows: fichas } = await c.query(`select m.first_name||' '||m.last_name as nombre, sl.* from study_leaders sl join members m on m.id=sl.member_id where sl.member_id = any($1)`, [CDEB.map(p => p.id)])
  const { rows: enrs } = await c.query(`select * from study_enrollments where id = any($1)`, [CDEB.filter(p => p.enr).map(p => p.enr)])
  for (const p of CDEB) {
    const f = fichas.find(x => x.member_id === p.id); if (!f || f.nombre !== p.nombre) throw new Error(`ficha no coincide: ${p.nombre}`)
    const e = p.enr ? enrs.find(x => x.id === p.enr) : null
    if (p.enr && (!e || e.member_id !== p.id)) throw new Error(`inscripción no coincide: ${p.nombre}`)
    console.log(`${p.nombre.padEnd(32)} ficha ${f.estado_base}/${f.detalle_no_ejerce ?? '-'} → BORRAR · CDEB ${e ? e.status + ' → reprobado' : '(sin inscripción, no se toca)'}`)
  }
  console.log(`grupo «${g.name}»: dirigente Marco → Tatiana, codirigente Tatiana → (nadie); Marco → inactivo sin razón, comité y rol fuera`)
  if (!APLICAR) { console.log('\nDRY RUN: nada aplicado'); await c.end(); return }

  const backup = {
    fecha: new Date().toISOString(), etiqueta: ETIQUETA, study_group: g, study_leaders: [slMarco, ...fichas], study_enrollments: enrs,
    volunteers: (await c.query(`select * from volunteers where member_id=$1 and position_id=any($2) and status='active'`, [MARCO, puestosDirigente])).rows,
    member_roles: (await c.query(`select * from member_roles where member_id=$1 and role='dirigente' and is_active`, [MARCO])).rows,
  }
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 1))
  const audit = (action, tipo, id, old, nuevo) => c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ($1,$2,$3,$4,$5)`, [action, tipo, id, old, { ...nuevo, origen: ETIQUETA, script: SCRIPT }])

  await c.query('begin')
  try {
    let r = await c.query(`update study_groups set leader_id=$2, co_leader_id=null, updated_at=now() where id=$1 and leader_id=$3`, [GRUPO, TATIANA, MARCO])
    if (r.rowCount !== 1) throw new Error('grupo no actualizó')
    await audit('UPDATE', 'study_groups', GRUPO, { leader_id: MARCO, co_leader_id: TATIANA }, { op: 'grupo_cambia_dirigente', leader_id: TATIANA, co_leader_id: null, motivo: 'Tatiana Arauz pasa a dirigente principal; Marco Acuña sale del grupo' })
    const nota = `${slMarco.nota_general ? slMarco.nota_general + '\n\n' : ''}${ETIQUETA}: deja de ser dirigente (sale del Nivel 4 de octubre 2026, que queda con Tatiana Arauz)`
    r = await c.query(`update study_leaders set estado_base='inactivo', is_active=false, availability_status='inactive', disponibilidad=null, razon_no_disponible=null, pausa_hasta=null,
      razon_inactivo=null, detalle_no_ejerce=null, situacion_cdeb=null, nota_general=$2 where member_id=$1 and estado_base='activo'`, [MARCO, nota])
    if (r.rowCount !== 1) throw new Error('Marco no actualizó')
    const v = await c.query(`update volunteers set status='inactive' where member_id=$1 and position_id=any($2) and status='active'`, [MARCO, puestosDirigente])
    const mr = await c.query(`update member_roles set is_active=false, revoked_at=now() where member_id=$1 and role='dirigente' and is_active`, [MARCO])
    await audit('UPDATE', 'study_leaders', slMarco.id, { estado_base: 'activo', disponibilidad: slMarco.disponibilidad }, { op: 'dirigente_inactivo', persona: 'Marco Acuna Gomez', member_id: MARCO, comite_inactivados: v.rowCount, roles_revocados: mr.rowCount })
    for (const p of CDEB) {
      const f = fichas.find(x => x.member_id === p.id)
      if (p.enr) {
        const e = enrs.find(x => x.id === p.enr)
        if (e.status !== 'reprobado') {
          const n = `${e.notes ? e.notes + '\n\n' : ''}${ETIQUETA}: no aprobó el CDEB; la inscripción pasa de «${e.status}» a reprobado.`
          r = await c.query(`update study_enrollments set status='reprobado', completed_at=null, notes=$2, updated_at=now() where id=$1`, [p.enr, n])
          if (r.rowCount !== 1) throw new Error(`inscripción no actualizó: ${p.nombre}`)
          await audit('UPDATE', 'study_enrollments', p.enr, { status: e.status, completed_at: e.completed_at }, { op: 'cdeb_reprobado', persona: p.nombre, member_id: p.id, status: 'reprobado' })
        }
      }
      r = await c.query(`delete from study_leaders where member_id=$1`, [p.id])
      if (r.rowCount !== 1) throw new Error(`ficha no se borró: ${p.nombre}`)
      await audit('DELETE', 'study_leaders', f.id, { estado_base: f.estado_base, razon_inactivo: f.razon_inactivo, detalle_no_ejerce: f.detalle_no_ejerce }, { op: 'dirigente_borrar_ficha', persona: p.nombre, member_id: p.id, motivo: 'no es dirigente, no aprobó el CDEB' })
    }
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }

  console.log('\nDESPUÉS:')
  console.log(JSON.stringify((await c.query(`select g.name, l.first_name||' '||l.last_name as dirigente, g.co_leader_id from study_groups g join members l on l.id=g.leader_id where g.id=$1`, [GRUPO])).rows[0]))
  console.log(JSON.stringify((await c.query(`select estado_base, razon_inactivo, is_active, (select count(*) from volunteers where member_id=$1 and position_id=any($2) and status='active') comite_activo, (select count(*) from member_roles where member_id=$1 and role='dirigente' and is_active) rol_activo from study_leaders where member_id=$1`, [MARCO, puestosDirigente])).rows[0]))
  for (const row of (await c.query(`select m.first_name||' '||m.last_name as nombre, (select count(*) from study_leaders where member_id=m.id) ficha, (select string_agg(e.status, ',') from study_enrollments e join study_groups g on g.id=e.group_id join study_plans p on p.id=g.plan_id where e.member_id=m.id and p.code='CDEB') cdeb from members m where m.id = any($1) order by 1`, [CDEB.map(p => p.id)])).rows) console.log(JSON.stringify(row))
  console.log(`\nRespaldo en ${BACKUP}`)
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })

/**
 * Correcciones a la base de dirigentes que mandó Estudios Bíblicos (WhatsApp, 28/10/2026).
 *
 *   node scripts/dirigentes-2026-10-28/correcciones.cjs              # dry run
 *   node scripts/dirigentes-2026-10-28/correcciones.cjs --aplicar
 *
 * Qué hace, por persona (IDs de ficha, nunca por nombre):
 *   · Alessandro Liberatoscioli → inactivo / no asiste (años sin ir a Theos).
 *   · Fabiola Montero y Gabriela Anchía → vuelven a activo / no disponible /
 *     en pausa, como estaban antes de la revisión del 26-oct que las puso
 *     inactivas por error; se les devuelve el rol `dirigente` y la fila del
 *     Comité Dirigentes (las mismas filas del respaldo del 26-oct).
 *   · Iván Rugama, Naomi Peraza, Jorge Montero Sibaja y Kimberly Webb → nunca
 *     fueron dirigentes: se BORRA la ficha de dirigente (study_leaders). La
 *     persona sigue en members; sus grupos históricos apuntan a members y no
 *     se tocan.
 *   · Jose Francisco Sánchez Navarro, Antonio Buitrago y Félix Badilla →
 *     inactivo / asiste pero no ejerce / no aprobó el CDEB. La situación
 *     (definitivo o seguimiento) queda en blanco hasta que coordinación diga.
 *   · Milena Halsband → ya está inactiva por «no asiste» (se fue a otra
 *     iglesia); solo se anexa la nota de que no aprobó el CDEB.
 *
 * Respaldo en docs/correcciones/2026-10-28-dirigentes-correcciones-estudios.json
 * y una fila de audit_log por persona (sin actor, como los crons).
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const BACKUP = 'docs/correcciones/2026-10-28-dirigentes-correcciones-estudios.json'
const SCRIPT = 'scripts/dirigentes-2026-10-28/correcciones.cjs'
const ETIQUETA = 'Corrección de Estudios Bíblicos (28/10/2026)'
const POS_DIRIGENTE_CR = 'ca56c3ec-cb60-4a62-99d7-42a3a2175c42'

const PLAN = [
  { id: '8a35386c-36ee-4aba-b63b-326b346f67a6', nombre: 'Alessandro Liberatoscioli', op: 'inactivo_no_asiste', nota: 'tiene años de no ir a Theos; pasa a inactivo' },
  { id: '7b1f9c1e-d4e7-443c-abc5-1692f895d4f5', nombre: 'Fabiola Montero Soto', op: 'vuelve_a_pausa', nota: 'no está inactiva sino en pausa; se revierte la baja del 26/10', vol: 'a51fdb7c-c4ee-432b-8288-654bfde36025', rol: 'a162fcb7-ae58-49c9-a268-13430bfaeaa5' },
  { id: '531f4867-8884-4501-bf0a-3a425e55a470', nombre: 'Gabriela Anchia Ureña', op: 'vuelve_a_pausa', nota: 'no está inactiva sino en pausa; se revierte la baja del 26/10', vol: '99aad9cf-6d17-41fc-8d7c-8b3d1a51e36d', rol: 'b4947936-1ac4-4c44-b471-8f45433a3c87' },
  { id: '756cacd6-6450-4d42-b760-3eaaad5e4802', nombre: 'Iván Rugama Soto', op: 'borrar_ficha', nota: 'no es dirigente: no ha llevado Discípulos' },
  { id: '38140465-9e1c-4b8d-8b32-f2624e57359a', nombre: 'Naomi Peraza Chacon', op: 'borrar_ficha', nota: 'no es dirigente: solo ha llevado niveles' },
  { id: '0da2c625-4e3d-47e2-9ea0-4945fcabf271', nombre: 'Jorge Montero Sibaja', op: 'borrar_ficha', nota: 'no es dirigente' },
  { id: 'bc89e3b2-f65e-472f-bc8d-b48267fe053e', nombre: 'Kimberly Webb Campos', op: 'borrar_ficha', nota: 'no es dirigente' },
  { id: 'fa3116d6-b069-4221-b928-b7566cfd0ad7', nombre: 'Jose Francisco Sanchez Navarro', op: 'no_aprobo_cdeb', nota: 'no es dirigente, no pasó el CDEB' },
  { id: 'd3d2fad4-4e86-498c-bcca-2fc8cde071a4', nombre: 'Antonio Buitrago', op: 'no_aprobo_cdeb', nota: 'no es dirigente, no pasó el CDEB' },
  { id: '4fb38e72-9ac7-478d-ad2a-d244ddc1e7b4', nombre: 'Felix Badilla Vargas', op: 'no_aprobo_cdeb', nota: 'no es dirigente, no pasó el CDEB' },
  { id: '7d28a3a4-1085-4f68-9325-83699c8a4292', nombre: 'Milena Halsband', op: 'solo_nota', nota: 'no es dirigente, no pasó el CDEB (sigue como «no asiste»: se fue a otra iglesia)' },
]

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query("set statement_timeout = '120s'")
  const ids = PLAN.map(p => p.id)
  const { rows: fichas } = await c.query(`select m.first_name||' '||m.last_name as nombre, sl.* from study_leaders sl join members m on m.id=sl.member_id where sl.member_id = any($1)`, [ids])
  const porId = Object.fromEntries(fichas.map(f => [f.member_id, f]))
  for (const p of PLAN) {
    const f = porId[p.id]
    if (!f) throw new Error(`sin ficha de dirigente: ${p.nombre}`)
    if (f.nombre !== p.nombre) throw new Error(`nombre no coincide para ${p.id}: ${f.nombre}`)
    if ((f.nota_general ?? '').includes(ETIQUETA)) throw new Error(`ya aplicado: ${p.nombre}`)
    console.log(`${p.op.padEnd(20)} ${p.nombre.padEnd(32)} ahora: ${f.estado_base}/${f.razon_inactivo ?? '-'}/${f.detalle_no_ejerce ?? '-'} ${f.disponibilidad ?? ''}${f.razon_no_disponible ? '/' + f.razon_no_disponible : ''}`)
  }
  const { rows: abiertos } = await c.query(`select g.name from study_groups g where (g.leader_id = any($1) or g.co_leader_id = any($1)) and g.status in ('en_curso','en_matricula')`, [ids])
  if (abiertos.length) throw new Error(`alguien tiene grupo abierto: ${abiertos.map(g => g.name).join(' | ')}`)
  if (!APLICAR) { console.log('\nDRY RUN: nada aplicado'); await c.end(); return }

  const backup = {
    fecha: new Date().toISOString(), etiqueta: ETIQUETA, plan: PLAN,
    study_leaders: fichas,
    volunteers: (await c.query(`select * from volunteers where id = any($1)`, [PLAN.filter(p => p.vol).map(p => p.vol)])).rows,
    member_roles: (await c.query(`select * from member_roles where id = any($1)`, [PLAN.filter(p => p.rol).map(p => p.rol)])).rows,
  }
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 1))

  await c.query('begin')
  try {
    for (const p of PLAN) {
      const f = porId[p.id]
      const nota = `${f.nota_general ? f.nota_general + '\n\n' : ''}${ETIQUETA}: ${p.nota}`
      let r
      if (p.op === 'inactivo_no_asiste') {
        r = await c.query(`update study_leaders set estado_base='inactivo', is_active=false, availability_status='inactive', disponibilidad=null, razon_no_disponible=null, pausa_hasta=null,
          razon_inactivo='no_asiste', detalle_no_ejerce=null, situacion_cdeb=null, nota_general=$2 where member_id=$1`, [p.id, nota])
      } else if (p.op === 'no_aprobo_cdeb') {
        r = await c.query(`update study_leaders set estado_base='inactivo', is_active=false, availability_status='inactive', disponibilidad=null, razon_no_disponible=null, pausa_hasta=null,
          razon_inactivo='asiste_no_ejerce', detalle_no_ejerce='no_aprobo_cdeb', situacion_cdeb=null, nota_general=$2 where member_id=$1`, [p.id, nota])
      } else if (p.op === 'solo_nota') {
        r = await c.query(`update study_leaders set nota_general=$2 where member_id=$1`, [p.id, nota])
      } else if (p.op === 'vuelve_a_pausa') {
        r = await c.query(`update study_leaders set estado_base='activo', is_active=true, availability_status='resting', disponibilidad='no_disponible', razon_no_disponible='pausa', pausa_hasta=null,
          razon_inactivo=null, detalle_no_ejerce=null, situacion_cdeb=null, nota_general=$2 where member_id=$1`, [p.id, nota])
        const v = await c.query(`update volunteers set status='active' where id=$1 and member_id=$2 and position_id=$3 and status='inactive'`, [p.vol, p.id, POS_DIRIGENTE_CR])
        const mr = await c.query(`update member_roles set is_active=true, revoked_at=null, revoked_by=null where id=$1 and member_id=$2 and role='dirigente' and not is_active`, [p.rol, p.id])
        if (v.rowCount !== 1 || mr.rowCount !== 1) throw new Error(`comité/rol no se restauró para ${p.nombre} (${v.rowCount}/${mr.rowCount})`)
      } else if (p.op === 'borrar_ficha') {
        r = await c.query(`delete from study_leaders where member_id=$1`, [p.id])
      }
      if (r.rowCount !== 1) throw new Error(`no actualizó a ${p.nombre}`)
      await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ($1, 'study_leaders', $2, $3, $4)`,
        [p.op === 'borrar_ficha' ? 'DELETE' : 'UPDATE', f.id, { estado_base: f.estado_base, razon_inactivo: f.razon_inactivo, disponibilidad: f.disponibilidad, razon_no_disponible: f.razon_no_disponible },
          { op: `dirigente_${p.op}`, persona: p.nombre, member_id: p.id, motivo: p.nota, origen: ETIQUETA, script: SCRIPT }])
    }
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }

  const { rows: despues } = await c.query(`select m.first_name||' '||m.last_name as nombre, sl.estado_base, sl.razon_inactivo, sl.detalle_no_ejerce, sl.disponibilidad, sl.razon_no_disponible, sl.is_active,
      (select string_agg(role, ',') from member_roles where member_id=m.id and is_active and role='dirigente') as rol,
      (select string_agg(v.status, ',') from volunteers v where v.member_id=m.id and v.position_id=$2) as comite_cr
    from members m left join study_leaders sl on sl.member_id=m.id where m.id = any($1) order by 1`, [ids, POS_DIRIGENTE_CR])
  console.log('\nDESPUÉS:'); for (const d of despues) console.log(JSON.stringify(d))
  console.log(`\nRespaldo en ${BACKUP}`)
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })

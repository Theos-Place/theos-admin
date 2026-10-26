/**
 * Revisión de dirigentes activos (Excel del 2026-10-26).
 *
 * Las filas «Activo» del Excel pasan a INACTIVO con la misma mecánica de
 * `setDirigenteActive(false)`: study_leaders (estado_base/is_active/mirror),
 * voluntariado del Comité Dirigentes → inactive, rol `dirigente` → revocado.
 * La nota del Excel se ANEXA a nota_general (nunca se pisa lo que había).
 * Las filas «Inactivo» solo reciben la nota: ya estaban inactivas.
 *
 *   node scripts/dirigentes-2026-10-26/aplicar.cjs <filas.json> <backup.json>            # dry run
 *   node scripts/dirigentes-2026-10-26/aplicar.cjs <filas.json> <backup.json> --aplicar
 *
 * NO se toca a quien tiene grupo abierto (en curso / en matrícula, sin
 * prematrimonial): es el guard de setDirigenteActive. Match por nombre
 * exacto con una sola ficha viva, si no se reporta (regla de AGENTS.md).
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const [, , FILAS, BACKUP, flag] = process.argv
const APLICAR = flag === '--aplicar'
const ETIQUETA = 'Revisión de dirigentes activos (26/10/2026)'
const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()

/** Solo cuando la nota lo dice con todas las letras. Lo demás queda sin razón, para que coordinación la elija. */
const NO_ASISTE = ['ya no esta en theos', 'ya no va a theos', 'ya no es de theos', 'ya no tiene relacion con theos',
  'dejo theos', 'esta en otra iglesia', 'no ha vuelto a theos', 'totalmente inactiv', 'completamente inactiv',
  'paro de asistir', 'no asiste desde', 'dejo de asistir', 'inactivo en todo']
const razonDe = nota => NO_ASISTE.some(p => norm(nota).includes(p)) ? 'no_asiste' : null

;(async () => {
  const filas = JSON.parse(fs.readFileSync(FILAS, 'utf8'))
  const c = nuevoCliente(); await c.connect()
  await c.query("set statement_timeout = '120s'")

  const { rows: fichas } = await c.query(`
    select m.id, m.first_name, m.last_name, m.is_active as miembro_vivo, row_to_json(sl) as sl,
      (select string_agg(g.name||' ['||g.status||']', ' | ') from study_groups g join study_plans p on p.id=g.plan_id
         where (g.leader_id=m.id or g.co_leader_id=m.id) and g.status in ('en_curso','en_matricula') and p.code<>'PREMAT') as grupos
    from study_leaders sl join members m on m.id=sl.member_id`)
  const { rows: puestos } = await c.query(`
    select sp.id, sp.title from service_positions sp join areas a on a.id=sp.area_id
    where a.area_type='committee' and a.name='Comité Dirigentes'`)
  const puestosDirigente = puestos.filter(p => norm(p.title).startsWith('dirigente')).map(p => p.id)
  if (puestosDirigente.length === 0) throw new Error('sin puestos de dirigente en el comité')

  const plan = []; const omitidos = []
  for (const f of filas) {
    const n = norm(f.nombre)
    const match = fichas.filter(x => x.miembro_vivo && norm(`${x.first_name} ${x.last_name}`) === n)
    if (match.length !== 1) { omitidos.push({ ...f, motivo: `${match.length} fichas vivas con ese nombre` }); continue }
    const m = match[0]
    const desactivar = f.estado === 'Activo'
    if (!desactivar && (m.sl.nota_general ?? '').includes(ETIQUETA)) { omitidos.push({ ...f, motivo: 'la nota ya está anexada' }); continue }
    if (desactivar && m.grupos) { omitidos.push({ ...f, motivo: `tiene grupo abierto: ${m.grupos}` }); continue }
    if (desactivar && m.sl.estado_base !== 'activo') { omitidos.push({ ...f, motivo: `ya está ${m.sl.estado_base} en el sistema` }); continue }
    plan.push({ fila: f, memberId: m.id, nombre: `${m.first_name} ${m.last_name}`, sl: m.sl, desactivar, razon: desactivar ? razonDe(f.nota) : null })
  }

  console.log(`\n═══ ${APLICAR ? 'APLICANDO' : 'DRY RUN'} ═══`)
  console.log('filas:', filas.length, '· pasan a inactivo:', plan.filter(p => p.desactivar).length,
    '· solo nota (ya inactivos):', plan.filter(p => !p.desactivar).length, '· omitidos:', omitidos.length)
  console.log('razón no_asiste explícita:', plan.filter(p => p.razon === 'no_asiste').length,
    '· sin razón (la elige coordinación):', plan.filter(p => p.desactivar && !p.razon).length)
  for (const o of omitidos) console.log('  OMITIDO', o.nombre, '→', o.motivo)
  for (const p of plan) console.log(`  ${p.desactivar ? 'BAJA ' : 'NOTA '} ${p.nombre.padEnd(34)} ${p.sl.disponibilidad ?? '-'}/${p.sl.razon_no_disponible ?? '-'} → ${p.razon ?? '(sin razón)'}${p.fila.nota ? '' : '  [sin nota en el Excel]'}`)
  if (!APLICAR) { await c.end(); return }

  const ids = plan.map(p => p.memberId)
  const backup = {
    fecha: new Date().toISOString(), etiqueta: ETIQUETA, omitidos,
    study_leaders: plan.map(p => p.sl),
    volunteers: (await c.query(`select * from volunteers where member_id = any($1) and position_id = any($2) and status='active'`, [ids, puestosDirigente])).rows,
    member_roles: (await c.query(`select * from member_roles where member_id = any($1) and role='dirigente' and is_active`, [ids])).rows,
  }
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 1))

  await c.query('begin')
  try {
    let bajas = 0, notas = 0, vols = 0, roles = 0
    for (const p of plan) {
      const anexo = p.fila.nota ? `${ETIQUETA}: ${p.fila.nota}` : `${ETIQUETA}: pasa a inactivo (sin nota en la lista)`
      const nota = p.sl.nota_general ? `${p.sl.nota_general}\n\n${anexo}` : anexo
      if (p.desactivar) {
        const r = await c.query(`update study_leaders set estado_base='inactivo', is_active=false, availability_status='inactive',
            disponibilidad=null, razon_no_disponible=null, pausa_hasta=null,
            razon_inactivo=$2, detalle_no_ejerce=null, situacion_cdeb=null, nota_general=$3
          where member_id=$1 and estado_base='activo'`, [p.memberId, p.razon, nota])
        if (r.rowCount !== 1) throw new Error(`study_leaders no actualizó a ${p.nombre}`)
        bajas++
        const v = await c.query(`update volunteers set status='inactive' where member_id=$1 and position_id=any($2) and status='active'`, [p.memberId, puestosDirigente])
        vols += v.rowCount
        const mr = await c.query(`update member_roles set is_active=false, revoked_at=now() where member_id=$1 and role='dirigente' and is_active`, [p.memberId])
        roles += mr.rowCount
      } else {
        const r = await c.query(`update study_leaders set nota_general=$2 where member_id=$1`, [p.memberId, nota])
        if (r.rowCount !== 1) throw new Error(`nota no se guardó para ${p.nombre}`)
        notas++
      }
    }
    await c.query('commit')
    console.log(`\nAPLICADO: ${bajas} bajas, ${notas} solo nota, ${vols} filas de comité inactivadas, ${roles} roles revocados`)
    // verificación
    const v = await c.query(`select count(*) filter (where estado_base='inactivo') as inactivos, count(*) filter (where is_active) as is_active_true,
      count(*) filter (where disponibilidad is not null) as con_disp from study_leaders where member_id = any($1)`, [plan.filter(p => p.desactivar).map(p => p.memberId)])
    console.log('verificación (bajas):', v.rows[0])
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })

/**
 * Mover a UNA persona de un puesto a otro, entre comités distintos.
 *   node scripts/madre-2026-09/mover-personas-de-comite.cjs [--aplicar]
 *
 * Para los casos donde el madre dejó a alguien con un puesto que pertenece a
 * otro comité. Cada línea es una decisión del usuario, no una inferencia.
 *
 * OJO con el efecto en los roles: cualquier puesto del Comité Estudios Bíblicos
 * otorga `solicitudes_estudio`, así que sacar a alguien de ahí se lo quita. El
 * script lo reporta y la resincronización de roles se corre después.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')

/** external_id, de (comité, puesto) → a (comité, puesto). */
const MOVIMIENTOS = [
  // Usuario 2026-09-11: Orador Sede y Asistente Logistica no son de Estudios
  // Bíblicos. Las sedes de Daniela y Gustavo salen de dónde asisten hoy.
  { ext: '165',   nombre: 'Fabiola Montero Soto',
    de: ['Comité Estudios Bíblicos', 'Orador Sede'],       a: ['Comité Oración', 'Orador Sede'] },
  { ext: '15482', nombre: 'Daniela Corrales Solera',
    de: ['Comité Estudios Bíblicos', 'Asistente Logistica'], a: ['Sede Meridiano Martes', 'Asistente Logistica'] },
  { ext: '9977',  nombre: 'Gustavo Johnson',
    de: ['Comité Estudios Bíblicos', 'Asistente Logistica'], a: ['Sede Liberia', 'Asistente Logistica'] },
  { ext: '3167',  nombre: 'Mariela Miranda Soto',
    de: ['Comité Estudios Bíblicos', 'Colaborador Seguimiento'], a: ['Comité de Servidores', 'Colaborador Seguimiento'] },
]

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const idPuesto = async (comite, title) => (await c.query(
    `select sp.id from service_positions sp join areas a on a.id=sp.area_id
     where a.name=$1 and sp.title=$2 and sp.is_active`, [comite, title])).rows[0]?.id
  const idArea = async n => (await c.query(`select id from areas where name=$1`, [n])).rows[0]?.id

  await c.query('begin')
  let n = 0
  for (const m of MOVIMIENTOS) {
    const { rows: [p] } = await c.query(`select id from members where external_id=$1`, [m.ext])
    if (!p) { console.error(`ABORTA — no hay ficha con external_id ${m.ext}`); process.exit(1) }
    const de = await idPuesto(...m.de)
    if (!de) { console.log(`   ${m.nombre}: «${m.de[1]}» ya no está en ${m.de[0]} — nada que hacer`); continue }
    // El puesto destino puede no existir en ese comité: se crea (mismo criterio
    // que la Etapa 2, sin ficha porque el madre no la trae para ese comité).
    let a = await idPuesto(...m.a)
    let creado = false
    if (!a) {
      const area = await idArea(m.a[0])
      if (!area) { console.error(`ABORTA — no existe el comité ${m.a[0]}`); process.exit(1) }
      a = (await c.query(`insert into service_positions (area_id, title, is_active) values ($1,$2,true) returning id`, [area, m.a[1]])).rows[0].id
      creado = true
    }
    const { rows: suya } = await c.query(`select id, status from volunteers where member_id=$1 and position_id=$2`, [p.id, de])
    if (!suya.length) { console.log(`   ${m.nombre}: no está en «${m.de[1]}» — nada que hacer`); continue }
    const { rows: enDestino } = await c.query(`select id from volunteers where member_id=$1 and position_id=$2`, [p.id, a])
    if (enDestino.length) {
      await c.query(`update volunteers set status='active', end_date=null, updated_at=now() where id=$1`, [enDestino[0].id])
      await c.query(`update volunteers set status='inactive', end_date=coalesce(end_date,current_date), updated_at=now() where id=$1`, [suya[0].id])
    } else {
      await c.query(`update volunteers set position_id=$2, updated_at=now() where id=$1`, [suya[0].id, a])
    }
    console.log(`   ${m.nombre.padEnd(28)} ${m.de[0]} «${m.de[1]}»  →  ${m.a[0]} «${m.a[1]}»${creado ? ' (puesto creado)' : ''}`)
    n++
  }
  // Se DESACTIVAN, no se borran: member_role_position_grants todavía apunta a
  // ellos (el solicitudes_estudio que daban) y esa FK es ON DELETE CASCADE.
  // La resincronización de roles revoca esos grants y después el limpiador
  // genérico los borra.
  const { rowCount: borrados } = await c.query(`update service_positions sp set is_active=false, updated_at=now()
    where sp.is_active and sp.area_id=(select id from areas where name='Comité Estudios Bíblicos')
      and sp.title in ('Orador Sede','Asistente Logistica','Colaborador Seguimiento')
      and not exists (select 1 from volunteers v where v.position_id=sp.id and v.status='active')`)
  const { rows: eb } = await c.query(`select sp.title, (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int act
    from service_positions sp join areas a on a.id=sp.area_id where a.name='Comité Estudios Bíblicos' and sp.is_active order by act desc, sp.title`)
  console.log(`\nmovidos: ${n}   puestos de EB desactivados: ${borrados}`)
  console.log('Comité Estudios Bíblicos queda:'); eb.forEach(x => console.log(`   ${String(x.act).padStart(3)}  «${x.title}»`))
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

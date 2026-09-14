/**
 * Dejar activos SOLO los servicios que el CCB de hoy respalda.
 *   node scripts/servicios-ccb-2026-09-14/depurar.cjs [--aplicar]
 *
 * QUÉ SE ROMPIÓ. La depuración del 12-set comparó contra CCB por PERSONA:
 * "¿está esta persona en el CCB de hoy?". Si estaba, se le dejaban TODOS sus
 * puestos activos — incluidos los que la Etapa 3 le había creado el 11-set a
 * partir de filas viejas del Excel Madre. Por eso a George Vivas le aparece
 * "Colaborador Montaje" iniciado el 11 de setiembre: es un servicio de hace
 * años que el madre arrastraba y CCB ya no le da (CCB solo le da Logística en
 * Pedregal Miércoles y Jueves).
 *
 * LA COMPARACIÓN CORRECTA es por PAR (persona, puesto). El CSV de CCB no tiene
 * columna de estado: ES la foto de lo vigente, así que lo que no está ahí es
 * pasado.
 *
 * ALCANCE ACOTADO A PROPÓSITO: solo las filas que creó la ráfaga de la Etapa 3
 * (11-set 17:36, un minuto, 792 filas). Lo anterior no lo inventó esta
 * migración y lo hecho a mano en la app no se toca — misma regla que en la
 * depuración del 12-set.
 *
 * GUARDA: nadie se queda sin NINGUNA asignación activa. Si la última que le
 * queda a alguien es una de estas, se deja y se reporta aparte. Esos casos son
 * de dos tipos y los dos merecen ojo humano: gente de Madrid (que se decidió no
 * tocar) y puestos cuyo "Puesto oficial 2026" quedó vacío en el madre, donde la
 * traducción no puede saber si el CCB los respalda.
 *
 * Nada se borra: status='inactive' + end_date, que es lo que el flujo de
 * reintegro sabe deshacer.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const RAFAGA = '2026-09-11 17:36'   // minuto exacto de la Etapa 3, hora CR
const CCB = 'data-import/puestos-ccb-actual-2026-09-12.csv'

function leerCSV(t) {
  const filas = []; let i = 0, f = '', r = [], q = false
  while (i < t.length) { const ch = t[i]
    if (q) { if (ch === '"') { if (t[i+1] === '"') { f += '"'; i += 2; continue } q = false; i++; continue } f += ch; i++; continue }
    if (ch === '"') { q = true; i++; continue }
    if (ch === ',') { r.push(f); f = ''; i++; continue }
    if (ch === '\n') { r.push(f); filas.push(r); r = []; f = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    f += ch; i++ }
  if (f.length || r.length) { r.push(f); filas.push(r) }
  const head = filas.shift().map(h => h.replace(/^﻿/, '').replace(/^"|"$/g, ''))
  return filas.filter(x => x.length === head.length).map(x => Object.fromEntries(head.map((h, j) => [h, x[j]])))
}
const clave = (id, puesto) => `${id}|${L.norm(L.sinParentesis(puesto))}`

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const ccb = leerCSV(fs.readFileSync(CCB, 'utf8'))
  const personas = L.hoja('Personas')

  // (persona, puesto tal cual lo escribe CCB) → puesto oficial 2026.
  const oficial = new Map()
  for (const p of personas) {
    const of = String(p['Puesto oficial 2026']).trim()
    if (of) oficial.set(clave(String(p['Individual ID']).trim(), p['Puesto como está en CCB']), of)
  }
  // Pares que el CCB de hoy respalda. Si el madre no sabe traducir el puesto,
  // se guarda el nombre crudo: preferimos NO marcar antes que marcar de más.
  const respaldado = new Set()
  for (const r of ccb) {
    const id = String(r['Individual ID']).trim()
    const of = oficial.get(clave(id, r['Position Name']))
    respaldado.add(clave(id, of ?? r['Position Name']))
    if (of) respaldado.add(clave(id, r['Position Name']))
  }
  const enCCB = new Set(ccb.map(r => String(r['Individual ID']).trim()))

  const CR = `at time zone 'America/Costa_Rica'`
  const { rows: act } = await c.query(`select v.id, v.member_id, m.external_id,
      m.first_name||' '||m.last_name persona, sp.title puesto, a.name comite,
      substr((v.created_at ${CR})::text,1,16) minuto
    from volunteers v join members m on m.id=v.member_id
    join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    where v.status='active' and a.name not like '[prueba]%'`)

  const candidatas = act.filter(r =>
    r.minuto === RAFAGA &&
    enCCB.has(String(r.external_id)) &&
    !respaldado.has(clave(String(r.external_id), r.puesto)))

  // Guarda: nadie sin ninguna asignación activa.
  const porPersona = new Map()
  for (const r of act) porPersona.set(r.member_id, (porPersona.get(r.member_id) ?? 0) + 1)
  const marcadasPorPersona = new Map()
  for (const r of candidatas) marcadasPorPersona.set(r.member_id, (marcadasPorPersona.get(r.member_id) ?? 0) + 1)

  const bajar = [], revisar = []
  for (const r of candidatas) {
    if (porPersona.get(r.member_id) === marcadasPorPersona.get(r.member_id)) revisar.push(r)
    else bajar.push(r)
  }

  console.log(`CCB de hoy: ${ccb.length} asignaciones · ${enCCB.size} personas`)
  console.log(`activas hoy en el sistema: ${act.length} · ${new Set(act.map(r=>r.member_id)).size} personas\n`)
  console.log(`creadas por la ráfaga y SIN respaldo en el CCB de hoy: ${candidatas.length}`)
  console.log(`  · se dan de baja: ${bajar.length}  (${new Set(bajar.map(r=>r.persona)).size} personas)`)
  console.log(`  · se dejan para revisar a mano: ${revisar.length}  (serían la última del servidor)`)
  if (revisar.length) console.table(revisar.map(r => ({ persona: r.persona, puesto: r.puesto, comite: r.comite })))

  const ids = bajar.map(r => r.id)

  // Roles automáticos que quedarían colgando: el grant apunta al puesto, así
  // que si la asignación se apaga y el rol no, la persona conserva un acceso
  // (por ejemplo el check-in) que ya no le corresponde.
  const { rows: grants } = await c.query(`
    select g.role, count(*)::int n from member_role_position_grants g
    where (g.member_id, g.position_id) in (
      select v.member_id, v.position_id from volunteers v where v.id = any($1))
    group by 1 order by 2 desc`, [ids])
  console.log(`\nroles automáticos colgados de esas asignaciones: ${grants.reduce((s,g)=>s+g.n,0)}`)
  if (grants.length) console.table(grants)

  const csv = ['persona,puesto,comite,ccb_id,accion']
  for (const r of bajar) csv.push([r.persona, r.puesto, r.comite, r.external_id, 'baja'].map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(','))
  for (const r of revisar) csv.push([r.persona, r.puesto, r.comite, r.external_id, 'revisar a mano'].map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(','))
  fs.writeFileSync('data-import/servicios-sin-respaldo-ccb-2026-09-14.csv', csv.join('\n'))
  console.log('\nlista → data-import/servicios-sin-respaldo-ccb-2026-09-14.csv')

  await c.query('begin')
  const { rowCount: bajas } = await c.query(
    `update volunteers set status='inactive', end_date=coalesce(end_date, current_date), updated_at=now()
     where id = any($1) and status='active'`, [ids])
  const { rowCount: rolesFuera } = await c.query(
    `delete from member_role_position_grants g
     where (g.member_id, g.position_id) in (select v.member_id, v.position_id from volunteers v where v.id = any($1))`, [ids])
  // El rol solo se revoca si NO le queda otro puesto que se lo dé.
  const { rows: aRevocar } = await c.query(
    `select mr.role, m.first_name||' '||m.last_name persona
     from member_roles mr join members m on m.id=mr.member_id
     where mr.origen='automatico' and mr.is_active
       and mr.member_id in (select member_id from volunteers where id = any($1))
       and not exists (select 1 from member_role_position_grants g
                        where g.member_id=mr.member_id and g.role=mr.role)
     order by mr.role, persona`, [ids])
  const { rowCount: revocados } = await c.query(
    `update member_roles mr set is_active=false, revoked_at=now()
     where mr.origen='automatico' and mr.is_active
       and mr.member_id in (select member_id from volunteers where id = any($1))
       and not exists (select 1 from member_role_position_grants g
                        where g.member_id=mr.member_id and g.role=mr.role)`, [ids])

  const { rows: [q] } = await c.query(
    `select count(*)::int asignaciones, count(distinct v.member_id)::int personas
     from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
     where v.status='active' and a.name not like '[prueba]%'`)
  console.log(`\nbajas: ${bajas} · grants borrados: ${rolesFuera} · roles automáticos revocados: ${revocados}`)
  console.log(`QUEDA: ${q.asignaciones} asignaciones activas · ${q.personas} personas`)
  if (aRevocar.length) {
    const porRol = {}
    for (const r of aRevocar) (porRol[r.role] ??= []).push(r.persona)
    console.log('\nQUIÉN pierde un rol automático (nadie más se lo daba):')
    for (const [rol, ps] of Object.entries(porRol)) console.log(`  ${rol} (${ps.length}): ${ps.join(', ')}`)
  }

  // George, que es el caso que lo destapó.
  const { rows: g } = await c.query(`select sp.title puesto, a.name comite, v.status, v.start_date
    from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    where v.member_id=(select id from members where external_id='20698') order by v.status, sp.title`)
  console.log('\nGeorge Vivas quedaría así:'); console.table(g.map(x=>({puesto:x.puesto,comite:x.comite,estado:x.status,inicio:String(x.start_date).slice(0,10)})))

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback) — no se tocó nada.') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

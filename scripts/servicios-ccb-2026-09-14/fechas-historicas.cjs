/**
 * Sacarle la fecha inventada al historial de servicio.
 *   node scripts/servicios-ccb-2026-09-14/fechas-historicas.cjs [--aplicar]
 *
 * Las 236 asignaciones que la Etapa 3 creó el 11-set y que se dieron de baja
 * hoy quedaron diciendo "sirvió del 11 al 14 de setiembre de 2026". Eso es
 * falso: son servicios de hace años que el Excel Madre arrastraba. En el perfil
 * de George Vivas se lee que hizo Montaje tres días en setiembre, cuando lo
 * hizo hace años.
 *
 * De dónde salen las fechas reales: el export de CCB de agosto
 * (puestos-servicio-actuales-2026-08.csv) trae "Position History: Added
 * YYYY/MM/DD". Cubre solo lo que estaba vigente en agosto, así que alcanza para
 * 7 de las 236 — las que CCB soltó entre el 26 de agosto y el 12 de setiembre.
 *
 * Para las otras 229 NO HAY FUENTE. Ahí la respuesta honesta no es inventar
 * otra fecha: es dejarla vacía. El puesto se conserva —la persona sí sirvió
 * ahí— y la nota dice por qué no hay fechas. Un "—" es verdad; un
 * "11 set 2026" es mentira.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const CORTE_CCB = '2026-09-12'   // el export de CCB donde ya no aparecían
const NOTA = 'Servicio anterior importado de CCB (2026-09). No hay fecha en ninguna fuente disponible.'

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
const clave = (id, p) => `${id}|${L.norm(L.sinParentesis(p))}`

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const ago = leerCSV(fs.readFileSync('data-import/puestos-servicio-actuales-2026-08.csv', 'utf8'))
  const personas = L.hoja('Personas')
  const oficial = new Map()
  for (const p of personas) {
    const of = String(p['Puesto oficial 2026']).trim()
    if (of) oficial.set(clave(String(p['Individual ID']).trim(), p['Puesto como está en CCB']), of)
  }
  const fechaReal = new Map()
  for (const r of ago) {
    const id = String(r['Individual ID']).trim()
    const of = oficial.get(clave(id, r['Position Name'])) ?? r['Position Name']
    const m = String(r['Position History'] || '').match(/Added (\d{4})\/(\d{2})\/(\d{2})/)
    if (m) fechaReal.set(clave(id, of), `${m[1]}-${m[2]}-${m[3]}`)
  }

  // Solo las que la Etapa 3 inventó y ya están de baja: start 11-set y end hoy.
  const { rows } = await c.query(`select v.id, m.external_id, m.first_name||' '||m.last_name persona,
      sp.title puesto, a.name comite
    from volunteers v join members m on m.id=v.member_id
    join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    where v.status='inactive' and v.start_date=date '2026-09-11' and v.end_date=current_date`)

  const conFecha = [], sinFecha = []
  for (const r of rows) {
    const f = fechaReal.get(clave(String(r.external_id), r.puesto))
    if (f) conFecha.push({ ...r, inicio: f }); else sinFecha.push(r)
  }
  console.log(`filas con fecha inventada: ${rows.length}`)
  console.log(`  · con fecha real en el CCB de agosto: ${conFecha.length}`)
  console.log(`  · sin fuente, se dejan sin fecha:     ${sinFecha.length}`)
  console.table(conFecha.map(r => ({ persona: r.persona, puesto: r.puesto, inicio_real: r.inicio, fin: CORTE_CCB })))

  await c.query('begin')
  let arregladas = 0
  for (const r of conFecha) {
    const { rowCount } = await c.query(
      `update volunteers set start_date=$2, end_date=$3, updated_at=now() where id=$1`,
      [r.id, r.inicio, CORTE_CCB])
    arregladas += rowCount
  }
  const { rowCount: vaciadas } = await c.query(
    `update volunteers set start_date=null, end_date=null,
       notes=coalesce(nullif(notes,''), $2), updated_at=now()
     where id = any($1)`, [sinFecha.map(r => r.id), NOTA])

  console.log(`\ncon fecha real puesta: ${arregladas}`)
  console.log(`sin fecha (start y end en null + nota): ${vaciadas}`)

  const { rows: g } = await c.query(`select sp.title puesto, a.name comite, v.status, v.start_date, v.end_date, v.notes
    from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    where v.member_id=(select id from members where external_id='20698') order by v.status, sp.title`)
  console.log('\nHistorial de George Vivas:')
  console.table(g.map(x => ({ puesto: x.puesto, comite: x.comite, estado: x.status,
    desde: x.start_date ? String(x.start_date).slice(0,10) : '—',
    hasta: x.end_date ? String(x.end_date).slice(0,10) : '—',
    nota: (x.notes || '').slice(0, 34) })))

  const { rows: [q] } = await c.query(
    `select count(*)::int n from volunteers where start_date=date '2026-09-11' and end_date=current_date`)
  console.log(`\nfilas que todavía dicen "11-set → hoy": ${q.n}`)

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback) — no se tocó nada.') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

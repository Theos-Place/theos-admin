const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const q = s => '"' + String(s ?? '').replace(/"/g,'""') + '"'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  // Activos del comité en CUALQUIER puesto que empiece con "Dirigente".
  const COMITE = `
    select distinct v.member_id, sp.title as puesto
    from volunteers v join service_positions sp on sp.id=v.position_id
      join areas ar on ar.id=sp.area_id
    where ar.name='Comité Dirigentes' and v.status='active'
      and unaccent(lower(sp.title)) like 'dirigente%'`
  const n = await c.query(`select count(distinct member_id) n from (${COMITE}) x`)
  console.log(`activos del comité (3 puestos): ${n.rows[0].n}`)

  const alta = await c.query(`
    select m.id, m.first_name||' '||m.last_name nom, x.puesto,
           sl.member_id is not null as tiene_ficha, sl.is_active, sl.availability_status,
           exists(select 1 from member_roles r where r.member_id=m.id and r.role='dirigente' and r.is_active) tiene_rol
    from (${COMITE}) x join members m on m.id=x.member_id
      left join study_leaders sl on sl.member_id=m.id
    where sl.member_id is null or sl.is_active is not true
    order by 2`)
  const baja = await c.query(`
    select m.id, m.first_name||' '||m.last_name nom, sl.availability_status,
           exists(select 1 from member_roles r where r.member_id=m.id and r.role='dirigente' and r.is_active) tiene_rol
    from study_leaders sl join members m on m.id=sl.member_id
    where sl.is_active and m.id not in (select member_id from (${COMITE}) y)
    order by 2`)
  console.log(`\nA ACTIVAR en dirigentes (están en el comité): ${alta.rowCount}`)
  console.log(`  sin ficha de dirigente todavía: ${alta.rows.filter(r=>!r.tiene_ficha).length}`)
  console.log(`A DESACTIVAR (no están en el comité):        ${baja.rowCount}`)
  baja.rows.forEach(r => console.log(`    ${r.nom}`))

  const filas = [['Persona','Qué pasa','Puesto en el comité','Ficha de dirigente hoy','Tiene rol dirigente'].map(q).join(',')]
  alta.rows.forEach(r => filas.push([r.nom,'Se ACTIVA en dirigentes',r.puesto, r.tiene_ficha ? `${r.availability_status}` : 'no tiene ficha', r.tiene_rol?'sí':'no'].map(q).join(',')))
  baja.rows.forEach(r => filas.push([r.nom,'Se DESACTIVA','(no está en el comité)', r.availability_status, r.tiene_rol?'sí':'no'].map(q).join(',')))
  fs.writeFileSync('dirigentes-reconciliacion-2026-09-17.csv', '﻿'+filas.join('\n'))
  console.log(`\nCSV con ${filas.length-1} filas`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

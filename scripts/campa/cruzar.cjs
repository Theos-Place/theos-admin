/**
 * Campa de Servidores 2026 · Quién FUE, resuelto contra el padrón.
 *
 * El export de CCB trae 130 respuestas y solo 57 con "Individual ID". Se cruza
 * en cascada, de lo más confiable a lo menos:
 *
 *   1. external_id  → `member_por_external_id()`, NUNCA `members.external_id` a
 *      secas: la fusión de duplicados deja el id viejo en la ficha muerta y
 *      buscar por la columna devuelve a esa (regla de AGENTS.md).
 *   2. correo       → solo si hay EXACTAMENTE UNA ficha viva con ese correo.
 *      La base no tiene UNIQUE en email, así que dos es posible.
 *   3. nombre exacto → solo si hay EXACTAMENTE UNA ficha viva con ese nombre.
 *      Con cero o con dos se reporta y no se adivina: un regex sobre apellidos
 *      ya confundió a dos personas distintas.
 */
const XLSX = require('xlsx')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')

const ARCHIVO = '/Users/florianafonsecar/Downloads/export_form_responses_as_xlsx.xlsx'
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`

;(async () => {
  const wb = XLSX.readFile(ARCHIVO)
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, range: 4 })
  const c = await nuevoCliente(); await c.connect()

  const resueltos = new Map()   // member_id → cómo se resolvió
  const sinResolver = []

  for (const f of filas) {
    const ext = String(f['Individual ID'] ?? '').trim()
    const correo = String(f['Email'] ?? '').trim().toLowerCase()
    const nombre = `${f['First Name'] ?? ''} ${f['Last Name'] ?? ''}`.trim()

    // 1 · external_id
    if (ext) {
      const { rows } = await c.query('select member_por_external_id($1) as id', [ext])
      if (rows[0]?.id) { resueltos.set(rows[0].id, { via: 'external_id', nombre, ext }); continue }
    }
    // 2 · correo, solo si es único entre fichas vivas
    if (correo) {
      const { rows } = await c.query(
        'select id from members where is_active and lower(trim(email)) = $1', [correo])
      if (rows.length === 1) { resueltos.set(rows[0].id, { via: 'correo', nombre, correo }); continue }
      if (rows.length > 1) { sinResolver.push({ nombre, correo, ext, motivo: `${rows.length} fichas con ese correo` }); continue }
    }
    // 3 · nombre exacto, solo si es único entre fichas vivas
    const { rows } = await c.query(`
      select id from members
      where is_active and lower(regexp_replace(unaccent_es(first_name||' '||last_name),'\\s+',' ','g')) = $1`,
      [norm(nombre)]).catch(async () => {
        // Sin unaccent_es disponible: se compara en JS contra el padrón activo.
        const { rows: todos } = await c.query('select id, first_name, last_name from members where is_active')
        return { rows: todos.filter(t => norm(`${t.first_name} ${t.last_name}`) === norm(nombre)) }
      })
    if (rows.length === 1) { resueltos.set(rows[0].id, { via: 'nombre', nombre }); continue }
    sinResolver.push({ nombre, correo, ext, motivo: rows.length === 0 ? 'sin ficha' : `${rows.length} fichas con ese nombre` })
  }

  const porVia = {}
  for (const v of resueltos.values()) porVia[v.via] = (porVia[v.via] ?? 0) + 1
  console.log(`respuestas en el Excel: ${filas.length}`)
  console.log(`personas resueltas:     ${resueltos.size}`)
  Object.entries(porVia).forEach(([k, n]) => console.log(`   por ${k.padEnd(12)} ${n}`))
  console.log(`SIN resolver:           ${sinResolver.length}`)
  sinResolver.forEach(s => console.log(`   ${s.nombre.padEnd(32)} ${String(s.correo).padEnd(32)} ${s.motivo}`))

  fs.writeFileSync('/tmp/campa-fueron.json', JSON.stringify([...resueltos.keys()]))
  fs.writeFileSync('/tmp/campa-sin-resolver.csv', '﻿' + ['nombre,correo,individual_id,motivo',
    ...sinResolver.map(s => [q(s.nombre), q(s.correo), q(s.ext), q(s.motivo)].join(','))].join('\n'))
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

/**
 * Charla de Meridiano, 2026-10-27: siete personas nuevas quedaron sin fecha
 * de nacimiento porque el selector de fecha del check-in (nuevo desde el
 * 26-oct) no deja llegar a un año de nacimiento. Jimmy Peraza mandó las
 * fechas por WhatsApp; Floriana pidió cargarlas (2026-10-28).
 *
 * Se identifica por ID (fichas creadas esa noche), no por nombre.
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const BACKUP = 'docs/correcciones/2026-10-28-meridiano-fechas-de-nacimiento.json'
const FECHAS = [
  { id: 'a95577d0-440e-42f2-a447-871ed90adc5f', nombre: 'Maickol Saenz Jimenez', birth_date: '1996-06-12' },
  { id: '5c3f61ce-f64d-4898-b20a-4b6fc0aa69c2', nombre: 'Susan Jiménez Solís', birth_date: '1991-09-03' },
  // Jimmy la escribió «Jimenez Romero»; la ficha quedó «Jimemez» (dedo). Se corrige también.
  { id: '46a647ea-446f-4cbb-914a-6c48584a1100', nombre: 'Roy Jimemez Romero', birth_date: '2000-05-19', last_name: 'Jimenez Romero' },
  { id: '27a0cfbb-47a4-4f81-a5fa-85dbaf5ec4f4', nombre: 'Laura Urena Leal', birth_date: '1995-08-24' },
  { id: 'ebc21525-c0f0-4d7f-ba14-1dd2a298e8e4', nombre: 'Isabella Uzcátegui Ureña', birth_date: '2013-08-10' },
  { id: '309aa1f0-698e-40dd-a50d-f12dc11d92c6', nombre: 'Fernando Jose Lesme', birth_date: '2002-04-08' },
  { id: '5f5753cf-7955-420b-a629-7c1832cfd5ae', nombre: 'Omar Chacón Torres', birth_date: '1997-03-05' },
]

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query('select id, first_name, last_name, birth_date, created_at from members where id = any($1::uuid[])', [FECHAS.map(f => f.id)])
  const antes = []
  for (const f of FECHAS) {
    const r = rows.find(x => x.id === f.id)
    if (!r) throw new Error(`No existe ${f.nombre}`)
    const nombreBD = `${r.first_name} ${r.last_name}`
    if (nombreBD !== f.nombre) throw new Error(`Nombre distinto: esperaba «${f.nombre}», hay «${nombreBD}»`)
    if (r.birth_date) throw new Error(`${f.nombre} YA tiene fecha: ${r.birth_date}`)
    antes.push({ id: r.id, nombre: nombreBD, birth_date: r.birth_date, last_name: r.last_name })
    console.log(`${nombreBD.padEnd(28)} → ${f.birth_date}${f.last_name ? ` · apellido → ${f.last_name}` : ''}`)
  }
  if (!APLICAR) { console.log('\n(medición; --aplicar para escribir)'); await c.end(); return }
  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), motivo: 'Fechas de nacimiento de la charla de Meridiano (Jimmy Peraza, 2026-10-27)', antes, despues: FECHAS }, null, 2))
  await c.query('begin')
  try {
    for (const f of FECHAS) {
      const u = await c.query('update members set birth_date = $2, last_name = coalesce($3, last_name) where id = $1 and birth_date is null', [f.id, f.birth_date, f.last_name ?? null])
      if (u.rowCount !== 1) throw new Error(`No actualizó ${f.nombre}`)
      await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE', 'members', $1, $2, $3)`,
        [f.id, { birth_date: null, ...(f.last_name ? { last_name: 'Jimemez Romero' } : {}) }, { op: 'fecha_de_nacimiento_charla_meridiano', birth_date: f.birth_date, ...(f.last_name ? { last_name: f.last_name } : {}), fuente: 'WhatsApp Jimmy Peraza 2026-10-27', script: 'scripts/meridiano-2026-10-27/fechas-de-nacimiento.cjs' }])
    }
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  console.log('\nDespués:', (await c.query('select first_name, last_name, birth_date::text from members where id = any($1::uuid[]) order by created_at', [FECHAS.map(f => f.id)])).rows)
  console.log(`Respaldo en ${BACKUP}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

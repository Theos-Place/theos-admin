/**
 * FIN-9c · Los cinco créditos del 2026-10-07 vencían el 2027-10-08 por el
 * respaldo de 12 meses (ese día no había bloque futuro cargado). Floriana
 * (2026-10-27): todos vencen con el bloque siguiente, Bloque 1 2027
 * (cierre de matrícula 2027-01-22), como el de Irene Arias. Si llegan sin
 * usarse, el barrido diario los corre al siguiente.
 *
 *   node scripts/creditos-2026-10-27/alinear-vencimiento.cjs          # medir
 *   node scripts/creditos-2026-10-27/alinear-vencimiento.cjs --aplicar
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const APLICAR = process.argv.includes('--aplicar')
const BACKUP = 'docs/correcciones/2026-10-27-creditos-vencimiento-bloque-1-2027.json'

;(async () => {
  const c = nuevoCliente()
  await c.connect()
  const { rows: [bloque] } = await c.query(
    `select id, nombre, fecha_cierre_matricula::text as cierre from capacitacion_bloques
      where fecha_cierre_matricula > current_date order by fecha_cierre_matricula limit 1`)
  if (!bloque) throw new Error('No hay bloque siguiente cargado')
  const nuevo = `${bloque.cierre}T23:59:59.999-06:00`
  const { rows } = await c.query(
    `select s.id, m.first_name || ' ' || m.last_name as persona, s.discount_value, s.expires_at, s.reason
       from scholarships s join members m on m.id = s.member_id
      where s.kind = 'credito' and s.status = 'active'
        and s.expires_at > ($1::timestamptz)
      order by s.created_at`, [nuevo])
  console.log(`Bloque siguiente: ${bloque.nombre}, cierre ${bloque.cierre} → expires_at ${nuevo}`)
  console.log(`Créditos activos que vencen DESPUÉS de ese cierre: ${rows.length}`)
  for (const r of rows) console.log(`  ${r.persona} · ₡${Number(r.discount_value)} · vence ${r.expires_at.toISOString()} · ${r.reason}`)
  if (!APLICAR) { console.log('\n(medición; --aplicar para escribir)'); await c.end(); return }
  if (rows.length === 0) { await c.end(); return }

  fs.writeFileSync(BACKUP, JSON.stringify({
    fecha: new Date().toISOString(), motivo: 'FIN-9c: vencimiento alineado al bloque siguiente (Floriana, 2026-10-27)',
    bloque, nuevo_expires_at: nuevo,
    antes: rows.map(r => ({ id: r.id, persona: r.persona, discount_value: r.discount_value, expires_at: r.expires_at.toISOString() })),
  }, null, 2))
  await c.query('begin')
  try {
    const ids = rows.map(r => r.id)
    const upd = await c.query(
      `update scholarships set expires_at = $1::timestamptz where id = any($2::uuid[]) and status = 'active'`, [nuevo, ids])
    if (upd.rowCount !== ids.length) throw new Error(`Esperaba ${ids.length} filas, tocó ${upd.rowCount}`)
    for (const r of rows) {
      await c.query(
        `insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE', 'scholarships', $1, $2, $3)`,
        [r.id, { expires_at: r.expires_at.toISOString() },
          { op: 'vencimiento_alineado_al_bloque_siguiente', expires_at: nuevo, bloque: bloque.nombre, script: 'scripts/creditos-2026-10-27/alinear-vencimiento.cjs' }])
    }
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  const { rows: despues } = await c.query(
    `select m.first_name || ' ' || m.last_name as persona, s.expires_at from scholarships s join members m on m.id = s.member_id
      where s.kind = 'credito' and s.status = 'active' order by s.created_at`)
  console.log('\nDespués:')
  for (const r of despues) console.log(`  ${r.persona} · ${r.expires_at.toISOString()}`)
  console.log(`Respaldo en ${BACKUP}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })

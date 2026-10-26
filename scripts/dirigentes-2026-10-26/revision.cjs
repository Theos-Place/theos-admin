/**
 * Lista de dirigentes a marcar EN REVISIÓN (Excel del 2026-10-26).
 *
 * Solo pone la banderita: `revision` suma 'no_confirmo_datos' —el mismo
 * motivo genérico que usó el import DIR-13 cuando el origen no precisa
 * cuál— y la nota del Excel se ANEXA a nota_revision. NO toca el estado
 * base ni la disponibilidad. Match por nombre exacto con una sola ficha
 * viva; si no, se reporta.
 *
 *   node scripts/dirigentes-2026-10-26/revision.cjs <filas.json> <backup.json> [--aplicar]
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const [, , FILAS, BACKUP, flag] = process.argv
const APLICAR = flag === '--aplicar'
const ETIQUETA = 'Lista de revisión (26/10/2026)'
const MOTIVO = 'no_confirmo_datos'
const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()

;(async () => {
  const filas = JSON.parse(fs.readFileSync(FILAS, 'utf8'))
  const c = nuevoCliente(); await c.connect()
  await c.query("set statement_timeout = '120s'")
  const { rows: fichas } = await c.query(`
    select m.id, m.first_name, m.last_name, m.is_active as miembro_vivo, row_to_json(sl) as sl
    from study_leaders sl join members m on m.id=sl.member_id`)
  const plan = []; const omitidos = []
  for (const f of filas) {
    const n = norm(f.nombre)
    const match = fichas.filter(x => x.miembro_vivo && norm(`${x.first_name} ${x.last_name}`) === n)
    if (match.length !== 1) { omitidos.push({ ...f, motivo: `${match.length} fichas vivas con ese nombre` }); continue }
    const m = match[0]
    if ((m.sl.nota_revision ?? '').includes(ETIQUETA)) { omitidos.push({ ...f, motivo: 'ya anexada' }); continue }
    plan.push({ fila: f, memberId: m.id, nombre: `${m.first_name} ${m.last_name}`, sl: m.sl, yaTenia: (m.sl.revision ?? []).includes(MOTIVO) })
  }
  console.log(`\n═══ ${APLICAR ? 'APLICANDO' : 'DRY RUN'} ═══`)
  console.log('filas:', filas.length, '· se marcan:', plan.length, '· ya tenían la banderita:', plan.filter(p => p.yaTenia).length, '· omitidos:', omitidos.length)
  for (const o of omitidos) console.log('  OMITIDO', o.nombre, '→', o.motivo)
  for (const p of plan) console.log(`  ${p.nombre.padEnd(34)} BD ${p.sl.estado_base}/${p.sl.disponibilidad ?? '-'}/${p.sl.razon_no_disponible ?? '-'} rev=${JSON.stringify(p.sl.revision ?? [])}${p.fila.estado !== 'Activo' ? '  [Excel: ' + p.fila.estado + ']' : ''}${p.fila.nota ? '' : '  [sin nota]'}`)
  if (!APLICAR) { await c.end(); return }
  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), etiqueta: ETIQUETA, omitidos, study_leaders: plan.map(p => p.sl) }, null, 1))
  await c.query('begin')
  try {
    for (const p of plan) {
      const anexo = `${ETIQUETA}: ${p.fila.nota ?? 'marcada en revisión sin nota en la lista'}`
      const nota = p.sl.nota_revision ? `${p.sl.nota_revision}\n\n${anexo}` : anexo
      const rev = [...new Set([...(p.sl.revision ?? []), MOTIVO])]
      const r = await c.query(`update study_leaders set revision=$2, nota_revision=$3 where member_id=$1`, [p.memberId, rev, nota])
      if (r.rowCount !== 1) throw new Error(`no actualizó a ${p.nombre}`)
    }
    await c.query('commit')
    const v = await c.query(`select count(*) from study_leaders where member_id=any($1) and $2=any(revision) and nota_revision like '%'||$3||'%'`, [plan.map(p => p.memberId), MOTIVO, ETIQUETA])
    console.log(`\nAPLICADO: ${plan.length} marcados · verificación: ${v.rows[0].count}`)
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })

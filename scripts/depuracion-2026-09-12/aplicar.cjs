/**
 * DEPURACIÓN · Aplicar: baja del grupo (c) + los «Dirigente» viejos a «Dirigente CR».
 *   node scripts/depuracion-2026-09-12/aplicar.cjs [--aplicar]
 *
 * Lee la clasificación que dejó clasificar.cjs y la RECALCULA contra la base
 * antes de escribir: si algo cambió entre el dry-run y ahora, no se toca a
 * ciegas. Nada se borra — status='inactive' y end_date, que es lo que el flujo
 * de reintegro sabe deshacer.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const plan = JSON.parse(fs.readFileSync('scripts/depuracion-2026-09-12/clasificacion.json', 'utf8'))
  const ids = plan.c.map(x => x.id)

  // Guardia: solo se dan de baja las que SIGUEN activas y siguen siendo las mismas.
  const { rows: vivas } = await c.query(
    `select v.id from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
     where v.id = any($1) and v.status='active' and a.name not like '[prueba]%'`, [ids])
  console.log(`grupo (c) del dry-run: ${ids.length}   siguen activas ahora: ${vivas.length}`)

  await c.query('begin')
  const { rowCount: bajas } = await c.query(
    `update volunteers set status='inactive', end_date=coalesce(end_date, current_date), updated_at=now()
     where id = any($1) and status='active'`, [vivas.map(x => x.id)])

  // «Dirigente» viejo → «Dirigente CR» (decisión del usuario 2026-09-12).
  const { rows: [viejo] } = await c.query(
    `select sp.id from service_positions sp join areas a on a.id=sp.area_id
     where a.name='Comité de Dirigentes' and sp.title='Dirigente' and sp.is_active`)
  const { rows: [oficial] } = await c.query(
    `select sp.id from service_positions sp join areas a on a.id=sp.area_id
     where a.name='Comité de Dirigentes' and sp.title='Dirigente CR' and sp.is_active`)
  let movidos = 0, yaTenian = 0
  if (viejo && oficial) {
    // Quien YA tiene «Dirigente CR»: se le reactiva esa fila si hiciera falta y
    // se le cierra la vieja (la única member+puesto impide moverla).
    const { rows: choque } = await c.query(
      `select v.id, v.status from volunteers v where v.position_id=$1
        and exists (select 1 from volunteers w where w.position_id=$2 and w.member_id=v.member_id)`, [viejo.id, oficial.id])
    const activos = choque.filter(x => x.status === 'active').map(x => x.id)
    if (activos.length) {
      await c.query(`update volunteers set status='active', end_date=null, updated_at=now()
        where position_id=$2 and status <> 'active' and member_id in (select member_id from volunteers where id = any($1))`,
        [activos, oficial.id])
    }
    if (choque.length) {
      await c.query(`update volunteers set status='inactive', end_date=coalesce(end_date,current_date), updated_at=now()
        where id = any($1)`, [choque.map(x => x.id)])
      yaTenian = activos.length
    }
    const { rowCount } = await c.query(
      `update volunteers set position_id=$2, updated_at=now() where position_id=$1 and id <> all($3)`,
      [viejo.id, oficial.id, choque.map(x => x.id)])
    movidos = rowCount
    await c.query(`update service_positions set is_active=false, updated_at=now() where id=$1`, [viejo.id])
  }

  const { rows: [q] } = await c.query(
    `select count(*)::int asignaciones, count(distinct v.member_id)::int personas
     from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
     where v.status='active' and a.name not like '[prueba]%'`)
  console.log(`\nbajas: ${bajas}`)
  console.log(`«Dirigente» → «Dirigente CR»: ${movidos} movidos${yaTenian ? `, ${yaTenian} ya lo tenían (se les cerró el viejo)` : ''}`)
  console.log(`\nQUEDA: ${q.asignaciones} asignaciones activas · ${q.personas} personas`)
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })

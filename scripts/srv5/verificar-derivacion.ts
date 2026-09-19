/** SOLO LECTURA: la derivación por puesto (módulo puro) contra la base real. */
import { encargadosDelComite } from '../../src/lib/servers/encargados'
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select a.id, a.name, coalesce(json_agg(json_build_object(
      'title', sp.title, 'status', v.status, 'member_id', v.member_id))
      filter (where v.id is not null), '[]') puestos
    from areas a
    left join service_positions sp on sp.area_id=a.id and sp.is_active
    left join volunteers v on v.position_id=sp.id
    where a.area_type='committee' and a.is_active
    group by a.id, a.name order by a.name`)

  let conEncargado = 0, sin = 0, varios = 0
  const detalle: string[] = []
  for (const fila of r.rows) {
    const ids = encargadosDelComite(fila.puestos)
    if (!ids.length) { sin++; detalle.push(`  SIN  ${fila.name}`); continue }
    conEncargado++
    if (ids.length > 1) varios++
    const nombres = await c.query(
      `select first_name||' '||last_name n from members where id = any($1::uuid[]) order by 1`, [ids])
    detalle.push(`  ${String(ids.length).padStart(2)}   ${fila.name.padEnd(36)} ${nombres.rows.map((x: {n:string}) => x.n).join(' | ')}`)
  }
  console.log(detalle.join('\n'))
  console.log(`\ncomités con encargado: ${conEncargado} · sin encargado: ${sin} · con más de uno: ${varios}`)
  await c.end()
})().catch((e: Error) => { console.error(e.message); process.exit(1) })

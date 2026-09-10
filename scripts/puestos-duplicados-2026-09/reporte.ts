/**
 * Puestos repetidos dentro de un mismo comité: el mismo nombre escrito de dos
 * formas ("Colaborador Comida" y "Colaborador de Comida"). Parte la gente en
 * dos filas y nadie sabe a cuál asignar.
 *
 * El "de", "del", los artículos y las tildes NO cambian los roles automáticos
 * (POSITION_ROLE_RULES normaliza igual), así que fusionar es seguro del lado de
 * permisos. Lo que sí importa es a quién hay que mover antes de borrar.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'

/** Misma normalización que haría una persona al leer los dos nombres. */
export function normalizarTitulo(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(de|del|la|el|los|las)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

async function main() {
  const sb = createAdminClient()
  const { data: areas } = await sb.from('areas').select('id, name, area_type')
  const nombreArea = new Map((areas ?? []).map(a => [(a as {id:string}).id, (a as {name:string}).name]))
  const pos: { id: string; title: string; area_id: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('service_positions')
      .select('id, title, area_id').range(from, from + 999)
    if (error) throw error
    const filas = (data ?? []) as { id: string; title: string; area_id: string }[]
    pos.push(...filas)
    if (filas.length < 1000) break
  }
  // PAGINADO. Sin esto PostgREST devuelve 1000 filas y ya: la primera versión
  // de este reporte contó de menos y dijo que un puesto con gente estaba vacío
  // — justo el error que haría borrar el puesto equivocado.
  const activosPorPuesto = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data: vols, error } = await sb.from('volunteers')
      .select('position_id').eq('status', 'active').range(from, from + 999)
    if (error) throw error
    const filas = (vols ?? []) as { position_id: string }[]
    for (const v of filas) activosPorPuesto.set(v.position_id, (activosPorPuesto.get(v.position_id) ?? 0) + 1)
    if (filas.length < 1000) break
  }

  const porComite = new Map<string, Map<string, { id: string; title: string; activos: number }[]>>()
  for (const p of pos) {
    const clave = normalizarTitulo(p.title)
    const comite = porComite.get(p.area_id) ?? new Map()
    comite.set(clave, [...(comite.get(clave) ?? []), { id: p.id, title: p.title, activos: activosPorPuesto.get(p.id) ?? 0 }])
    porComite.set(p.area_id, comite)
  }

  let totalPares = 0, requierenMover = 0
  for (const [areaId, grupos] of porComite) {
    const reps = [...grupos.entries()].filter(([, v]) => v.length > 1)
    if (!reps.length) continue
    console.log(`\n══ ${nombreArea.get(areaId) ?? areaId}`)
    for (const [, v] of reps) {
      totalPares++
      const conGente = v.filter(x => x.activos > 0)
      const marca = conGente.length > 1 ? '⚠️ ' : '   '
      if (conGente.length > 1) requierenMover++
      for (const f of v) console.log(`${marca}${f.title.padEnd(38)} | activos: ${f.activos} | ${f.id}`)
      console.log()
    }
  }
  console.log(`\nTOTAL: ${totalPares} nombres repetidos.`)
  console.log(`De esos, ${requierenMover} tienen gente en LAS DOS filas: hay que mover personas antes de fusionar.`)
  console.log(`Los otros ${totalPares - requierenMover} son borrar la fila vacía y ya.`)
}
main().catch(e => { console.error(e); process.exit(1) })

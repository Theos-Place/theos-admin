import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EstructuraParaExportar } from '@/lib/servers/export-de-estructura'
import { esPuestoDeEncargado } from '@/lib/servers/encargados'
import { normSinArticulos } from '@/lib/servers/position-roles'

/**
 * Lee la estructura completa de servicio —áreas, comités y puestos— con lo que
 * hace falta para exportarla.
 *
 * Está aparte del handler para poder correrla contra la base de verdad desde un
 * script y ver el archivo que sale. Dentro de la ruta no se podía: `requireRoles`
 * pide contexto de request y no se deja reemplazar.
 */
export async function leerEstructuraDeServicio(): Promise<EstructuraParaExportar> {
  const supabase = createAdminClient()

  const [{ data: areasData }, { data: posData }, { data: volData }] = await Promise.all([
    supabase.from('areas')
      .select('id, name, description, area_type, parent_id, is_active, ideal_capacity')
      .order('name'),
    supabase.from('service_positions')
      .select('id, title, area_id, description, functions, profile, requirements, skills,'
        + ' study_requirement, location, quantity, max_volunteers, is_active, is_featured, expires_at')
      .order('title'),
    // Quién sirve hoy, por puesto. `status` activo es lo que cuenta: un
    // voluntariado histórico no ocupa un cupo.
    supabase.from('volunteers').select('position_id').eq('status', 'active'),
  ])

  type AreaDb = {
    id: string; name: string; description: string | null
    area_type: string; parent_id: string | null
    is_active: boolean; ideal_capacity: number | null
  }
  const todas = (areasData ?? []) as AreaDb[]
  const porId = new Map(todas.map(a => [a.id, a]))

  /**
   * QUIÉN ENCABEZA CADA COSA, con la regla que ya existe.
   *
   * Para los COMITÉS manda `esPuestoDeEncargado` (SRV-5): es la fuente única
   * que se decidió después de encontrar dos que no coincidían —el puesto
   * "Encargado…" y `areas.leader_id`—. Escribir acá un `ilike '%encargad%'`
   * habría sido inventar la tercera, y habría aceptado títulos que esa regla
   * descarta a propósito.
   *
   * Para las ÁREAS no aplica: ninguna tiene un puesto "Encargado", tienen un
   * DIRECTOR que cuelga directo del área. Por eso las dos columnas se llaman
   * distinto en el archivo.
   */
  const { data: cabezasData } = await supabase
    .from('volunteers')
    .select('position:service_positions!inner(area_id, title), member:members(first_name, last_name)')
    .eq('status', 'active')
  const cabezasPorArea = new Map<string, string[]>()
  for (const v of (cabezasData ?? []) as Array<{
    position: { area_id: string; title: string } | { area_id: string; title: string }[] | null
    member: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  }>) {
    const pos = Array.isArray(v.position) ? v.position[0] : v.position
    const mem = Array.isArray(v.member) ? v.member[0] : v.member
    if (!pos?.area_id || !mem) continue
    const contenedor = porId.get(pos.area_id)
    const cabeza = contenedor?.area_type === 'committee'
      ? esPuestoDeEncargado(pos.title)
      : normSinArticulos(pos.title).startsWith('director')
    if (!cabeza) continue
    const nombre = `${mem.first_name} ${mem.last_name}`.trim()
    const lista = cabezasPorArea.get(pos.area_id) ?? []
    if (!lista.includes(nombre)) lista.push(nombre)
    cabezasPorArea.set(pos.area_id, lista)
  }

  const sirviendoPorPuesto = new Map<string, number>()
  for (const v of (volData ?? []) as Array<{ position_id: string | null }>) {
    if (!v.position_id) continue
    sirviendoPorPuesto.set(v.position_id, (sirviendoPorPuesto.get(v.position_id) ?? 0) + 1)
  }

  const base = (a: AreaDb) => ({
    id: a.id, name: a.name, description: a.description,
    encargados: cabezasPorArea.get(a.id) ?? [],
    is_active: a.is_active !== false, ideal_capacity: a.ideal_capacity,
  })

  const areas = todas.filter(a => a.area_type === 'area').map(base)
  const comites = todas.filter(a => a.area_type === 'committee').map(a => ({
    ...base(a),
    area: a.parent_id ? porId.get(a.parent_id)?.name ?? null : null,
  }))

  const puestos = ((posData ?? []) as unknown as Array<Record<string, unknown>>).map(p => {
    const contenedor = porId.get(p.area_id as string)
    // Un puesto cuelga de un COMITÉ o directamente de un ÁREA; el export
    // tiene que decir las dos cosas o no se puede agrupar.
    const esComite = contenedor?.area_type === 'committee'
    const area = esComite
      ? (contenedor?.parent_id ? porId.get(contenedor.parent_id)?.name ?? null : null)
      : contenedor?.name ?? null
    return {
      id: p.id as string,
      title: p.title as string,
      comite: esComite ? contenedor!.name : null,
      area,
      description: (p.description as string) ?? null,
      functions: (p.functions as string) ?? null,
      profile: (p.profile as string) ?? null,
      requirements: (p.requirements as string) ?? null,
      skills: (p.skills as string) ?? null,
      study_requirement: (p.study_requirement as string) ?? null,
      location: (p.location as string) ?? null,
      quantity: (p.quantity as number) ?? null,
      max_volunteers: (p.max_volunteers as number) ?? null,
      is_active: p.is_active !== false,
      is_featured: p.is_featured === true,
      expires_at: (p.expires_at as string) ?? null,
      sirviendo: sirviendoPorPuesto.get(p.id as string) ?? 0,
    }
  })
  // Por área y comité, para que el archivo se lea en el mismo orden en que se
  // navega la pantalla y no alfabético por puesto.
  puestos.sort((a, b) =>
    (a.area ?? '').localeCompare(b.area ?? '', 'es')
    || (a.comite ?? '').localeCompare(b.comite ?? '', 'es')
    || a.title.localeCompare(b.title, 'es'))

  return { areas, comites, puestos }
}

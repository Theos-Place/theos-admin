import { createAdminClient } from '@/lib/supabase/admin'
import { tituloEsDeDirectorDeArea } from '@/lib/servers/director-de-area'

// Catálogo organizacional: áreas y sus comités (desde la tabla areas).
// NOTA: createAdminClient (service role) porque la app corre con mock auth.

export type OrgArea = {
  id: string; name: string; committees: string[]
  /** Quién dirige el área. Es un PUESTO colgado del área, no un campo de
   *  `areas` — ver `lib/servers/director-de-area`. Puede haber varios (Área
   *  Enseñanza tiene dos) y puede estar vacío (el puesto existe sin asignar). */
  directores: Array<{ id: string; name: string }>
}
export type OrgCommittee = { id: string; name: string; area_id: string | null; area_name: string }

export async function getOrgCatalog(): Promise<{ areas: OrgArea[]; committees: OrgCommittee[]; positions: string[] }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('areas')
    .select('id, name, area_type, parent_id, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as Array<{ id: string; name: string; area_type: string; parent_id: string | null }>
  const areaRows = rows.filter((r) => r.area_type === 'area')
  const commRows = rows.filter((r) => r.area_type === 'committee')
  const areaName = new Map(areaRows.map((a) => [a.id, a.name]))

  // Directores de área: los puestos que cuelgan de un ÁREA (no de un comité)
  // con su gente activa. Una consulta para las 8 áreas, no una por área.
  const { data: dirData } = await supabase
    .from('service_positions')
    .select('title, area_id, volunteers(status, member:members(id, first_name, last_name))')
    .in('area_id', areaRows.map((a) => a.id))
    .eq('is_active', true)

  const directoresPorArea = new Map<string, Array<{ id: string; name: string }>>()
  for (const p of (dirData ?? []) as Array<Record<string, unknown>>) {
    if (!tituloEsDeDirectorDeArea(p.title as string)) continue
    const areaId = p.area_id as string
    for (const v of (p.volunteers ?? []) as Array<{ status: string; member: unknown }>) {
      if (v.status !== 'active') continue
      const m = (Array.isArray(v.member) ? v.member[0] : v.member) as
        { id: string; first_name: string | null; last_name: string | null } | null
      if (!m) continue
      const lista = directoresPorArea.get(areaId) ?? []
      lista.push({ id: m.id, name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() })
      directoresPorArea.set(areaId, lista)
    }
  }

  const areas: OrgArea[] = areaRows.map((a) => ({
    id: a.id,
    name: a.name,
    committees: commRows.filter((c) => c.parent_id === a.id).map((c) => c.name),
    directores: (directoresPorArea.get(a.id) ?? [])
      .sort((x, y) => x.name.localeCompare(y.name, 'es')),
  }))
  const committees: OrgCommittee[] = commRows.map((c) => ({
    id: c.id,
    name: c.name,
    area_id: c.parent_id,
    area_name: c.parent_id ? (areaName.get(c.parent_id) ?? '') : '',
  }))
  // Catálogo de posiciones de servicio (títulos únicos, ordenados). Es la
  // misma columna contra la que filtra el padrón (service_positions.title),
  // reemplaza el SERVICE_POSITIONS estático de mock-committees (auditoría C3).
  const { data: posData, error: posError } = await supabase
    .from('service_positions')
    .select('title')
    .order('title', { ascending: true })
  if (posError) throw posError
  const positions = Array.from(
    new Set(((posData ?? []) as Array<{ title: string | null }>).map((p) => p.title).filter((t): t is string => !!t)),
  )

  return { areas, committees, positions }
}

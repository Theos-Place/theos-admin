import { createAdminClient } from '@/lib/supabase/admin'

// Catálogo organizacional: áreas y sus comités (desde la tabla areas).
// NOTA: createAdminClient (service role) porque la app corre con mock auth.

export type OrgArea = { id: string; name: string; committees: string[] }
export type OrgCommittee = { id: string; name: string; area_id: string | null; area_name: string }

export async function getOrgCatalog(): Promise<{ areas: OrgArea[]; committees: OrgCommittee[] }> {
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

  const areas: OrgArea[] = areaRows.map((a) => ({
    id: a.id,
    name: a.name,
    committees: commRows.filter((c) => c.parent_id === a.id).map((c) => c.name),
  }))
  const committees: OrgCommittee[] = commRows.map((c) => ({
    id: c.id,
    name: c.name,
    area_id: c.parent_id,
    area_name: c.parent_id ? (areaName.get(c.parent_id) ?? '') : '',
  }))
  return { areas, committees }
}

import type { createAdminClient } from '@/lib/supabase/admin'

// El embed self-FK `parent:areas!parent_id` es POCO FIABLE en PostgREST: lo trata
// como to-many y devuelve [] (no el objeto padre), dejando el nombre del área
// padre en blanco (ej. columna "Área" de los exports). Resolvemos el nombre del
// padre con un mapa id→{name, parent_id} de toda la tabla areas.

export type AreaMapEntry = { name: string; parent_id: string | null }

/** Mapa id→{name, parent_id} de TODAS las áreas (un solo query). */
export async function getAreaNameMap(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Map<string, AreaMapEntry>> {
  const { data } = await supabase.from('areas').select('id, name, parent_id')
  const map = new Map<string, AreaMapEntry>()
  for (const a of (data ?? []) as Array<{ id: string; name: string; parent_id: string | null }>) {
    map.set(a.id, { name: a.name, parent_id: a.parent_id })
  }
  return map
}

/** Nombre del área PADRE del área `areaId`, vía el mapa. '' si no tiene padre. */
export function parentAreaName(map: Map<string, AreaMapEntry>, areaId: string | null | undefined): string {
  if (!areaId) return ''
  const parentId = map.get(areaId)?.parent_id
  return parentId ? map.get(parentId)?.name ?? '' : ''
}

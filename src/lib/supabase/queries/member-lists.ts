import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
import type { MemberList } from '@/types/member-list'
import type { FilterState } from '@/types/filters'
import { sePuedeRecalcular } from '@/lib/members/list-refresh'

type DbRow = {
  id: string
  name: string
  description: string | null
  filters: FilterState | null
  segment_label: string | null
  member_ids: string[] | null
  member_count: number
  is_dynamic: boolean
  tags: string[] | null
  created_by: string | null
  last_used_at: string | null
  created_at: string
  updated_at: string
}

function toDomain(r: DbRow): MemberList {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    filters: r.filters ?? { conditions: [], groups: [] },
    segment_label: r.segment_label ?? '',
    member_ids: r.member_ids ?? [],
    member_count: r.member_count,
    is_dynamic: r.is_dynamic,
    created_by: r.created_by ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at,
    last_used_at: r.last_used_at,
    tags: r.tags ?? [],
  }
}

export type ListWriteInput = {
  name: string
  description?: string | null
  filters?: FilterState | null
  segment_label?: string | null
  member_ids?: string[]
  member_count?: number
  is_dynamic?: boolean
  tags?: string[]
  created_by?: string | null
}

export async function getMemberLists(): Promise<MemberList[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('member_lists').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as DbRow[]).map(toDomain)
}

export async function getMemberListById(id: string): Promise<MemberList | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('member_lists').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toDomain(data as DbRow) : null
}

export async function createMemberList(input: ListWriteInput): Promise<MemberList> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_lists')
    .insert({
      name: input.name,
      description: input.description ?? null,
      filters: input.filters ?? null,
      segment_label: input.segment_label ?? null,
      member_ids: input.member_ids ?? [],
      member_count: input.member_count ?? (input.member_ids?.length ?? 0),
      is_dynamic: input.is_dynamic ?? false,
      tags: input.tags ?? [],
      created_by: input.created_by ?? null,
    } as Insertable<'member_lists'>)
    .select('*')
    .single()
  if (error) throw error
  return toDomain(data as DbRow)
}

/**
 * Vuelve a correr los filtros guardados de una lista y reescribe su membresía.
 *
 * Es la pieza que le faltaba a las listas: `filters` se guardaba desde el
 * principio pero NADA lo volvía a leer, así que `member_ids` quedaba congelado
 * en el momento de crearla. Una lista marcada "Dinámica" mostraba un banner
 * diciendo que se recalculaba sola y no era cierto — y el botón "Actualizar
 * snapshot" de las estáticas solo tocaba `last_used_at`.
 *
 * Corre el MISMO getMemberIds que la pantalla de miembros, así que la lista
 * dice exactamente lo que diría esa búsqueda hoy.
 *
 * Devuelve también `antes`/`despues` para poder mostrar qué cambió — que es lo
 * que le importa a quien aprieta el botón.
 */
export async function recomputeMemberList(id: string): Promise<
  { ok: true; antes: number; despues: number; list: MemberList } | { ok: false; motivo: string }
> {
  const actual = await getMemberListById(id)
  if (!actual) return { ok: false, motivo: 'Lista no encontrada' }
  const f = actual.filters
  // Una lista sin filtros guardados no se puede recalcular: su membresía es lo
  // único que la define (ver sePuedeRecalcular, con tests).
  if (!sePuedeRecalcular(f)) {
    return { ok: false, motivo: 'La lista no tiene filtros guardados: su contenido es la única definición que tiene.' }
  }
  const { getMemberIds } = await import('./members')
  const { ids, total } = await getMemberIds({
    conditions: f.conditions, groups: f.groups,
    // Los chips de Donantes/Servidores viajan aparte de las condiciones. En las
    // listas viejas no están guardados (se agregaron con el recálculo), y por
    // eso una lista vieja que los usaba puede recalcular distinto: sin el chip,
    // el filtro es más ancho. Se avisa en la UI.
    is_donor: f.is_donor || undefined,
    is_server: f.is_server || undefined,
  })
  const supabase = createAdminClient()
  const { error } = await supabase.from('member_lists')
    .update({ member_ids: ids, member_count: total, updated_at: new Date().toISOString() } as Updatable<'member_lists'>)
    .eq('id', id)
  if (error) throw error
  return {
    ok: true, antes: actual.member_count, despues: total,
    list: { ...actual, member_ids: ids, member_count: total, updated_at: new Date().toISOString() },
  }
}

export async function updateMemberList(id: string, patch: Partial<ListWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('member_lists').update({ ...patch, updated_at: new Date().toISOString() } as Updatable<'member_lists'>).eq('id', id)
  if (error) throw error
}

export async function deleteMemberList(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('member_lists').delete().eq('id', id)
  if (error) throw error
}

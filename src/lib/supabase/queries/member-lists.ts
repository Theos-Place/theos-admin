import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
import type { MemberList } from '@/types/member-list'
import type { FilterState } from '@/types/filters'
import { motivoNoRecalculable } from '@/lib/members/list-refresh'
import type { EnvioQueUsaLaLista } from '@/lib/members/editar-lista'
import { SCHEDULED_STATUS } from '@/lib/communications/schedule'
import { nombresDeLosActores } from './audit'

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
  const motivo = motivoNoRecalculable(f)
  if (motivo) return { ok: false, motivo }
  // El filtro COMPLETO, igual que lo manda filterQS() en la pantalla de
  // miembros. Recalcular con un subconjunto ensancha la lista en silencio.
  const { getMemberIds } = await import('./members')
  const { ids, total } = await getMemberIds({
    conditions: f.conditions, groups: f.groups, topLevelOps: f.topLevelOps,
    is_donor: f.is_donor || undefined,
    is_server: f.is_server || undefined,
    active_attendance: f.active_attendance || undefined,
    search: (f.search ?? '').trim() || undefined,
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

/**
 * PAR-9 · Los comunicados PROGRAMADOS que salen a esta lista. El cron recalcula
 * la lista al enviarlos (ver `procesarProgramados`), así que cambiarle el
 * filtro cambia a quién le llega: la pantalla lo avisa antes de guardar.
 */
export async function enviosProgramadosConLaLista(id: string): Promise<EnvioQueUsaLaLista[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('message_broadcasts')
    .select('id, subject, channel, scheduled_at')
    .eq('status', SCHEDULED_STATUS)
    .eq('recipient_filter->>list_id', id)
    .order('scheduled_at')
  if (error) throw error
  return (data ?? []) as EnvioQueUsaLaLista[]
}

/** PAR-9 · Quién y cuándo la tocó por última vez (de la bitácora), y el
 *  nombre de quien la creó. */
export async function autoriaDeLaLista(lista: Pick<MemberList, 'id' | 'created_by'>): Promise<{
  creada_por: string | null
  ultima_edicion: { por: string | null; cuando: string } | null
}> {
  const supabase = createAdminClient()
  const [{ data: edicion }, { data: creador }] = await Promise.all([
    supabase.from('audit_log').select('actor_id, created_at')
      .eq('entity_type', 'member_lists').eq('entity_id', lista.id).eq('action', 'UPDATE')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    lista.created_by
      ? supabase.from('members').select('first_name, last_name').eq('id', lista.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const fila = edicion as { actor_id: string | null; created_at: string } | null
  const nombres = fila?.actor_id ? await nombresDeLosActores([fila.actor_id]) : new Map<string, string>()
  const c = creador as { first_name: string | null; last_name: string | null } | null
  return {
    creada_por: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || null : null,
    ultima_edicion: fila ? { por: fila.actor_id ? nombres.get(fila.actor_id) ?? null : null, cuando: fila.created_at } : null,
  }
}

/** PAR-9 · De los ids pedidos, los que son fichas que existen (para no meter
 *  basura en una lista fija). */
export async function fichasExistentes(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('members').select('id').in('id', [...ids])
  if (error) throw error
  return (data ?? []).map(r => (r as { id: string }).id)
}

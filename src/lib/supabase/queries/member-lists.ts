import { createAdminClient } from '@/lib/supabase/admin'
import type { MemberList } from '@/data/mock-member-lists'
import type { FilterState } from '@/types/filters'

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
    })
    .select('*')
    .single()
  if (error) throw error
  return toDomain(data as DbRow)
}

export async function updateMemberList(id: string, patch: Partial<ListWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('member_lists').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteMemberList(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('member_lists').delete().eq('id', id)
  if (error) throw error
}

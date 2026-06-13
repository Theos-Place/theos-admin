import type { FilterState } from '@/types/filters'

// Listas guardadas de miembros (tabla member_lists en Supabase).
export type MemberList = {
  id: string
  name: string
  description: string | null
  filters: FilterState
  segment_label: string
  member_ids: string[]
  member_count: number
  is_dynamic: boolean
  created_by: string
  created_at: string
  updated_at: string
  last_used_at: string | null
  tags: string[]
}

import type { FilterState } from '@/types/filters'

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

// Las listas guardadas ahora viven en Supabase (tabla member_lists).
// Este archivo conserva solo el tipo de dominio MemberList que consumen las vistas.

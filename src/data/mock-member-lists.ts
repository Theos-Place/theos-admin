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

// Sin listas de ejemplo: el store arranca vacío. Las listas se crean desde /miembros.
const BASE: MemberList[] = []

// Module-level mutable store so saves from /miembros persist to /miembros/listas within a session
const _store: MemberList[] = [...BASE]

export const listStore = {
  getAll: (): MemberList[] => [..._store],
  getById: (id: string): MemberList | undefined => _store.find(l => l.id === id),
  add: (list: MemberList): void => { _store.push(list) },
  remove: (id: string): void => {
    const i = _store.findIndex(l => l.id === id)
    if (i !== -1) _store.splice(i, 1)
  },
  update: (id: string, updates: Partial<MemberList>): void => {
    const i = _store.findIndex(l => l.id === id)
    if (i !== -1) Object.assign(_store[i], updates)
  },
}

// Apunta al store vivo para que las listas guardadas también aparezcan donde se
// consume (p. ej. comunicaciones), sin datos de ejemplo precargados.
export const MOCK_MEMBER_LISTS = _store

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

const BASE: MemberList[] = [
  {
    id: 'list-001',
    name: 'Donadores activos Heredia',
    description: 'Lista de donadores activos en la sede de Heredia',
    filters: {
      conditions: [{ id: 1, group: 'donor', type: 'donor', value: 'yes' }],
      groups: [],
    },
    segment_label: 'Donadores · Sede Heredia',
    member_ids: ['uuid-0001', 'uuid-0003', 'uuid-0005', 'uuid-0008', 'uuid-0010'],
    member_count: 234,
    is_dynamic: true,
    created_by: 'Admin Theos',
    created_at: '2026-03-12T10:00:00.000Z',
    updated_at: '2026-05-10T08:30:00.000Z',
    last_used_at: '2026-05-15T14:20:00.000Z',
    tags: ['donadores', 'heredia'],
  },
  {
    id: 'list-002',
    name: 'Estudiantes Nivel 4',
    description: null,
    filters: {
      conditions: [{ id: 1, group: 'study', type: 'study', study: 'N4', status: 'in_progress', from: null, to: null }],
      groups: [],
    },
    segment_label: 'Nivel 4 en progreso',
    member_ids: ['uuid-0002', 'uuid-0006', 'uuid-0007', 'uuid-0011'],
    member_count: 87,
    is_dynamic: true,
    created_by: 'Admin Theos',
    created_at: '2026-03-20T09:15:00.000Z',
    updated_at: '2026-04-01T11:00:00.000Z',
    last_used_at: '2026-04-28T16:45:00.000Z',
    tags: ['estudios'],
  },
  {
    id: 'list-003',
    name: 'Campamento Junio 2025',
    description: 'Lista fija de inscritos al campamento de junio 2025',
    filters: { conditions: [], groups: [] },
    segment_label: 'Inscritos Campamento Jun 2025',
    member_ids: ['uuid-0001', 'uuid-0002', 'uuid-0003', 'uuid-0004', 'uuid-0005', 'uuid-0006', 'uuid-0007', 'uuid-0008'],
    member_count: 187,
    is_dynamic: false,
    created_by: 'Admin Theos',
    created_at: '2025-05-20T08:00:00.000Z',
    updated_at: '2025-05-20T08:00:00.000Z',
    last_used_at: '2025-06-01T10:30:00.000Z',
    tags: ['campamento'],
  },
  {
    id: 'list-004',
    name: 'Nuevos últimos 30 días',
    description: 'Miembros registrados en los últimos 30 días',
    filters: { conditions: [], groups: [] },
    segment_label: 'Registrados últimos 30 días',
    member_ids: ['uuid-0010', 'uuid-0011', 'uuid-0012'],
    member_count: 43,
    is_dynamic: true,
    created_by: 'Admin Theos',
    created_at: '2026-04-18T07:45:00.000Z',
    updated_at: '2026-05-17T07:45:00.000Z',
    last_used_at: null,
    tags: ['nuevos'],
  },
  {
    id: 'list-005',
    name: 'Servidores sin nivel 4',
    description: 'Servidores activos que aún no han completado el Nivel 4',
    filters: {
      conditions: [{ id: 1, group: 'service', type: 'service', area: '', committee: '', position: '', status: 'active', from: '', to: '' }],
      groups: [],
    },
    segment_label: 'Servidores · Sin N4 completado',
    member_ids: ['uuid-0004', 'uuid-0007', 'uuid-0009'],
    member_count: 31,
    is_dynamic: true,
    created_by: 'Admin Theos',
    created_at: '2026-05-01T12:00:00.000Z',
    updated_at: '2026-05-01T12:00:00.000Z',
    last_used_at: '2026-05-08T09:15:00.000Z',
    tags: ['servidores'],
  },
]

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

export const MOCK_MEMBER_LISTS = BASE

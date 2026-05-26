/**
 * Mock authentication config for development.
 * Todas las variables usan NEXT_PUBLIC_ para ser accesibles desde el cliente.
 * En producción este archivo se reemplaza por auth real.
 *
 * .env.local:
 *   NEXT_PUBLIC_MOCK_ADMIN_EMAIL / NEXT_PUBLIC_MOCK_ADMIN_PASSWORD
 *   NEXT_PUBLIC_MOCK_FINANCE_EMAIL / NEXT_PUBLIC_MOCK_FINANCE_PASSWORD
 *   etc.
 */

const isDev = process.env.NODE_ENV === 'development'

export type MockUser = {
  email: string
  cedula: string
  password: string
  roles: readonly string[]
  name: string
  member_id: string
}

export const MOCK_USERS: MockUser[] = [
  {
    email:     process.env.NEXT_PUBLIC_MOCK_ADMIN_EMAIL    ?? 'admin@theosplace.org',
    cedula:    '1-0000-0001',
    password:  process.env.NEXT_PUBLIC_MOCK_ADMIN_PASSWORD ?? (isDev ? 'dev-only' : ''),
    roles:     ['admin'] as const,
    member_id: 'mock-member-1',
    name:      'Admin Theos',
  },
  {
    email:     process.env.NEXT_PUBLIC_MOCK_FINANCE_EMAIL    ?? 'finanzas@theosplace.org',
    cedula:    '1-0000-0002',
    password:  process.env.NEXT_PUBLIC_MOCK_FINANCE_PASSWORD ?? (isDev ? 'dev-only' : ''),
    roles:     ['finanzas'] as const,
    member_id: 'mock-member-2',
    name:      'Jennifer Zamora',
  },
  {
    email:     process.env.NEXT_PUBLIC_MOCK_STAFF_EMAIL    ?? 'staff@theosplace.org',
    cedula:    '1-0000-0003',
    password:  process.env.NEXT_PUBLIC_MOCK_STAFF_PASSWORD ?? (isDev ? 'dev-only' : ''),
    roles:     ['encargado_staff'] as const,
    member_id: 'mock-member-3',
    name:      'Carlos Araya',
  },
  {
    email:     process.env.NEXT_PUBLIC_MOCK_LEADER_EMAIL    ?? 'dirigente@theosplace.org',
    cedula:    '1-0000-0004',
    password:  process.env.NEXT_PUBLIC_MOCK_LEADER_PASSWORD ?? (isDev ? 'dev-only' : ''),
    roles:     ['dirigente'] as const,
    member_id: 'mock-member-4',
    name:      'Diego Salazar',
  },
  {
    email:     process.env.NEXT_PUBLIC_MOCK_MEMBER_EMAIL    ?? 'miembro@theosplace.org',
    cedula:    '1-0000-0005',
    password:  process.env.NEXT_PUBLIC_MOCK_MEMBER_PASSWORD ?? (isDev ? 'dev-only' : ''),
    roles:     ['miembro'] as const,
    member_id: 'mock-member-5',
    name:      'María Rodríguez',
  },
]

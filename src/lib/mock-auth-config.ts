/**
 * Mock authentication config for development.
 * Credentials are read from environment variables.
 * In production this entire file gets replaced by real auth.
 *
 * To override locally, set variables in .env.local:
 *   NEXT_PUBLIC_MOCK_ADMIN_EMAIL / MOCK_ADMIN_PASSWORD
 *   MOCK_FINANCE_PASSWORD / MOCK_STAFF_PASSWORD / etc.
 */

const isDev = process.env.NODE_ENV === 'development'

export type MockUser = {
  email: string
  cedula: string
  password: string
  roles: string[]
  name: string
  member_id: string
}

export const MOCK_USERS: MockUser[] = [
  {
    email:     process.env.NEXT_PUBLIC_MOCK_ADMIN_EMAIL      ?? 'admin@theosplace.org',
    cedula:    '1-0000-0001',
    password:  process.env.MOCK_ADMIN_PASSWORD               ?? (isDev ? 'dev-only-password' : ''),
    roles:     ['admin'],
    name:      'Admin Theos',
    member_id: 'mock-member-1',
  },
  {
    email:     process.env.NEXT_PUBLIC_MOCK_FINANCE_EMAIL    ?? 'finanzas@theosplace.org',
    cedula:    '1-0000-0002',
    password:  process.env.MOCK_FINANCE_PASSWORD             ?? (isDev ? 'dev-only-password' : ''),
    roles:     ['finanzas'],
    name:      'Jennifer Zamora',
    member_id: 'mock-member-2',
  },
  {
    email:     process.env.NEXT_PUBLIC_MOCK_STAFF_EMAIL      ?? 'staff@theosplace.org',
    cedula:    '1-0000-0003',
    password:  process.env.MOCK_STAFF_PASSWORD               ?? (isDev ? 'dev-only-password' : ''),
    roles:     ['encargado_staff'],
    name:      'Carlos Araya',
    member_id: 'mock-member-3',
  },
  {
    email:     process.env.NEXT_PUBLIC_MOCK_DIRIGENTE_EMAIL  ?? 'dirigente@theosplace.org',
    cedula:    '1-0000-0004',
    password:  process.env.MOCK_DIRIGENTE_PASSWORD           ?? (isDev ? 'dev-only-password' : ''),
    roles:     ['dirigente'],
    name:      'Diego Salazar',
    member_id: 'mock-member-4',
  },
  {
    email:     process.env.NEXT_PUBLIC_MOCK_MEMBER_EMAIL     ?? 'miembro@theosplace.org',
    cedula:    '1-0000-0005',
    password:  process.env.MOCK_MEMBER_PASSWORD              ?? (isDev ? 'dev-only-password' : ''),
    roles:     ['miembro'],
    name:      'María Rodríguez',
    member_id: 'mock-member-5',
  },
]

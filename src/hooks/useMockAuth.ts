'use client'

import { useState, useEffect } from 'react'
import type { RoleId } from '@/data/mock-auth'
import { DEFAULT_ROLE } from '@/data/mock-auth'

export interface MockUser {
  name: string
  email: string
  role: string
  roles: RoleId[]
  member_id?: string
}

const ROLE_MAP: Record<string, RoleId> = {
  admin:        'admin',
  direccion:    'direccion',
  finance:      'finanzas',
  finanzas:     'finanzas',
  staff_leader: 'encargado_staff',
}

export function useMockAuth() {
  const [user, setUser] = useState<MockUser | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('theos_user') || localStorage.getItem('theos_user')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const derived: RoleId[] = parsed.roles?.length > 0
          ? parsed.roles
          : parsed.role ? [ROLE_MAP[parsed.role] ?? parsed.role as RoleId] : [DEFAULT_ROLE]
        const roles: RoleId[] = derived
        setUser({ ...parsed, roles })
      } catch { /* ignore */ }
    }
    setLoaded(true)
  }, [])

  function isMemberOnly(): boolean {
    return user?.roles?.length === 1 && user.roles[0] === 'miembro'
  }

  function hasRole(...roleIds: RoleId[]): boolean {
    return user?.roles?.some(r => roleIds.includes(r)) ?? false
  }

  return { user, loaded, isMemberOnly, hasRole }
}

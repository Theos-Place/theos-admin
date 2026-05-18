'use client'

import { useMockAuth } from './useMockAuth'
import { ROLES } from '@/data/mock-auth'

type Action = 'view' | 'create' | 'edit' | 'delete' | 'export'
type Scope = 'own' | 'committee' | 'all'

export function usePermissions() {
  const { user } = useMockAuth()

  function can(module: string, action: Action): boolean {
    if (!user?.roles?.length) return false

    return user.roles.some(roleId => {
      const role = ROLES.find(r => r.id === roleId)
      if (!role) return false
      return role.permissions.some(
        p => (p.module === 'all' || p.module === module) && p.actions.includes(action)
      )
    })
  }

  function getScope(module: string): Scope | null {
    if (!user?.roles?.length) return null

    const scopes = user.roles.flatMap(roleId => {
      const role = ROLES.find(r => r.id === roleId)
      if (!role) return []
      return role.permissions
        .filter(p => p.module === module || p.module === 'all')
        .map(p => p.scope ?? 'all')
    })

    if (scopes.includes('all')) return 'all'
    if (scopes.includes('committee')) return 'committee'
    if (scopes.includes('own')) return 'own'
    return null
  }

  return { can, getScope }
}

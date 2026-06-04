'use client'

import type { RoleId } from '@/data/mock-auth'
import { useAuth, type AuthUser } from '@/lib/auth/auth-context'

// NOTA: el nombre se mantiene por compatibilidad con los consumidores.
// La data ahora viene de la sesión real de Supabase vía AuthProvider.
export type { AuthUser as MockUser }

export function useMockAuth() {
  const { user, loaded } = useAuth()

  function isMemberOnly(): boolean {
    return user?.roles?.length === 1 && user.roles[0] === 'miembro'
  }

  function hasRole(...roleIds: RoleId[]): boolean {
    return user?.roles?.some(r => roleIds.includes(r)) ?? false
  }

  return { user, loaded, isMemberOnly, hasRole }
}

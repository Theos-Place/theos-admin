'use client'

import { useAuth as useAuthContext, type AuthUser } from '@/lib/auth/auth-context'
import type { RoleId } from '@/types/auth'

export type { AuthUser }

/**
 * Hook de autenticación real (Supabase Auth). La sesión se resuelve server-side
 * vía /api/auth/me (usuario de auth → member por auth_user_id → roles activos de
 * member_roles). signIn/signOut van por las rutas /api/auth/* que setean cookies SSR.
 */
export function useAuth() {
  const { user, loaded } = useAuthContext()
  const roles: RoleId[] = user?.roles ?? []

  /** Inicia sesión con correo/cédula + contraseña. Devuelve true si fue exitoso. */
  async function signIn(identifier: string, password: string): Promise<boolean> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })
    return res.ok
  }

  async function signOut(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' })
  }

  function isMemberOnly(): boolean {
    return roles.length === 1 && roles[0] === 'miembro'
  }

  function hasRole(...roleIds: RoleId[]): boolean {
    return roles.some(r => roleIds.includes(r))
  }

  return {
    user,
    member: user?.member_id ? { id: user.member_id } : null,
    roles,
    loading: !loaded,
    loaded,            // alias de compatibilidad
    signIn,
    signOut,
    isMemberOnly,
    hasRole,
  }
}

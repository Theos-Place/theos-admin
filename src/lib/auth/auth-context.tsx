'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { RoleId } from '@/types/auth'

export interface AuthUser {
  name: string
  email: string
  role: string | null
  roles: RoleId[]
  member_id: string | null
}

interface AuthState {
  user: AuthUser | null
  loaded: boolean
}

const AuthContext = createContext<AuthState>({ user: null, loaded: false })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loaded: false })

  useEffect(() => {
    let alive = true
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : { user: null }))
      .then(data => { if (alive) setState({ user: data.user ?? null, loaded: true }) })
      .catch(() => { if (alive) setState({ user: null, loaded: true }) })
    return () => { alive = false }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

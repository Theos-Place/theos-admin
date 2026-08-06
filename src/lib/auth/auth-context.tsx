'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { RoleId } from '@/types/auth'

export interface AuthUser {
  name: string
  email: string
  role: string | null
  roles: RoleId[]
  member_id: string | null
  /** Ids de miembros de la misma familia (mismo family_unit_id) — para saber
   *  qué perfiles puede ver además del propio. */
  family_member_ids: string[]
  /** ¿El miembro tiene cédula registrada? false → recordatorio (banner). */
  has_cedula: boolean
  /** Perfil de sistema (cuenta institucional): excluido del recordatorio de cédula. */
  is_system: boolean
  /** Puesto activo en el comité de estudios bíblicos: habilita
   *  /estudios/solicitudes con alcance acotado (solo lo asignado a la persona),
   *  incluso sin ningún rol. */
  in_study_committee?: boolean
  /** Formularios con acceso puntual (form_access_grants). Habilitan
   *  /formularios y las respuestas de ESOS formularios sin tener el módulo. */
  granted_form_ids?: string[]
  /** Eventos que tiene a cargo (event_managers). Le abren /eventos y el detalle
   *  de ESOS eventos aunque no tenga el módulo. */
  managed_event_ids?: string[]
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

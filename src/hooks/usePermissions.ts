'use client'

import { useAuth } from './useAuth'
import { hasModulePermission, moduleScope } from '@/lib/auth/roles'

type Action = 'view' | 'create' | 'edit' | 'delete' | 'export'
type Scope = 'own' | 'committee' | 'all'

export function usePermissions() {
  const { user, loaded } = useAuth()

  // QA-3 tanda 4 (2026-10-15) · Las dos reglas son las MISMAS que usa el
  // servidor (lib/auth/roles): antes estaban copiadas acá, y el día que una
  // copia cambiara sin la otra la pantalla y el guard dirían cosas distintas.
  function can(module: string, action: Action): boolean {
    if (!user?.roles?.length) return false
    return hasModulePermission(user.roles, module, action)
  }

  function getScope(module: string): Scope | null {
    if (!user?.roles?.length) return null
    return moduleScope(user.roles, module)
  }

  /**
   * ¿Ya sabemos quién es? Hasta que no cargue la sesión, `can()` devuelve false
   * para todo — no porque no tenga permiso, sino porque todavía no hay roles.
   *
   * Toda pantalla que muestre "Acceso restringido" TIENE que esperar esto. Sin
   * eso, la pantalla se pinta denegada por un instante en CADA carga y después
   * salta al contenido. Se veía hasta en el tutorial grabado del check-in.
   */
  return { can, getScope, loaded }
}

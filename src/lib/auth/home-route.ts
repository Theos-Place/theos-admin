// SEC-1 (ampliado 2026-07-29): qué roles aterrizan en su PERFIL en vez del
// dashboard. Decisión: miembro, dirigente y líder de comité no tienen
// dashboard — sus herramientas viven en el sidebar (Grupos / Servidores) y su
// página default es el perfil (abierto en Resumen). Cualquier rol
// administrativo adicional conserva el dashboard.
import type { RoleId } from '@/types/auth'

const PROFILE_HOME_ROLES: ReadonlySet<RoleId> = new Set(['miembro', 'dirigente', 'lider_comite'])

/** true = esta sesión no tiene dashboard: /dashboard la redirige a su perfil.
 *  Sin roles (default 'miembro') también aterriza en el perfil. */
export function landsOnProfile(roles: RoleId[]): boolean {
  if (roles.length === 0) return true
  return roles.every(r => PROFILE_HOME_ROLES.has(r))
}

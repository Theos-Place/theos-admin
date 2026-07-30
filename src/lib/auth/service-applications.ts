// Solicitudes de servicio (/servidores/aplicaciones): la pantalla y su listado
// son SOLO para el coordinador de servidores y admin (decisión 2026-07-30).
// El staff y dirección siguen gestionando una aplicación puntual desde el
// detalle de la vacante; lo que se acota es la BANDEJA completa.
import type { RoleId } from '@/types/auth'

export const SERVICE_APPLICATIONS_ROLES: RoleId[] = ['coordinador_servidores', 'admin']

export function canSeeServiceApplications(roles: RoleId[]): boolean {
  return roles.some(r => SERVICE_APPLICATIONS_ROLES.includes(r))
}

// Aplicaciones a puestos de servicio (/servidores/aplicaciones).
//
// Nació acotada al coordinador de servidores y admin (decisión 2026-07-30):
// el staff y dirección gestionaban una aplicación puntual desde el detalle de
// la vacante, y lo que se cerraba era la BANDEJA completa.
//
// SRV-14 (2026-09-25) la abre a dos más, y no es un aflojamiento: el trabajo
// de revisar, mandar al encargado y dar seguimiento lo hacen dos puestos
// concretos del comité de servidores —Colaborador Aplicaciones y Colaborador
// Seguimiento—, que ahora tienen su propio rol en vez de tener que ser
// coordinadores de todo. `direccion` entra como vista, según el mapa de
// accesos de la Fase 24.
import type { RoleId } from '@/types/auth'

export const SERVICE_APPLICATIONS_ROLES: RoleId[] = [
  'coordinador_servidores', 'admin', 'aplicaciones_servicio', 'direccion',
]

export function canSeeServiceApplications(roles: RoleId[]): boolean {
  return roles.some(r => SERVICE_APPLICATIONS_ROLES.includes(r))
}

/**
 * SRV-14 · Quién GESTIONA una aplicación (cambiar su estado), que no es lo
 * mismo que verla.
 *
 * `lider_comite` está porque el encargado del comité resuelve las de SU
 * comité desde el detalle de la vacante — es un flujo que ya existía y no se
 * toca. `direccion` VE la bandeja pero no aparece acá: su acceso es de
 * lectura según el mapa de accesos de la Fase 24, y aceptar da de alta a
 * alguien con permisos.
 */
export const GESTIONAN_APLICACIONES: RoleId[] = [
  'encargado_staff', 'coordinador_servidores', 'lider_comite', 'admin',
  'aplicaciones_servicio',
]

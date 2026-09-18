/**
 * AUD-2 · Qué entidades tienen historial y qué permiso pide cada una.
 *
 * Es una LISTA BLANCA a propósito: `entity_type` viaja en la URL y entra
 * directo en la consulta a `audit_log`. Sin esto, cualquiera con una sesión
 * podría pedir el historial de `member_roles`, de `areas` o de cualquier tabla
 * que ningún módulo cubra — el log tiene filas de once tablas.
 *
 * Puro y compartido: lo usan el endpoint (para autorizar) y la UI (para saber
 * si mostrar el panel).
 */
export const MODULO_POR_ENTIDAD = {
  members: 'miembros',
  payments: 'finanzas',
  study_enrollments: 'estudios',
} as const

export type EntidadAuditable = keyof typeof MODULO_POR_ENTIDAD

export function tieneHistorial(entityType: string): entityType is EntidadAuditable {
  return entityType in MODULO_POR_ENTIDAD
}

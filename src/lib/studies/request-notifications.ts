// Quién recibe la notificación de "solicitud de estudios nueva" (reubicación e
// interés). Puro y testeable sin Supabase: la query trae las filas de
// member_roles y esta función decide, así la audiencia no se define a mano en
// cada llamada.
//
// Bug 2026-08-04: se reportó a un miembro SIN roles recibiendo el aviso. La
// regla queda explícita acá y con test, y se agregan dos candados que faltaban:
// el solicitante no se notifica a sí mismo (si es coordinador) y el rol tiene
// que estar activo EN un miembro activo.
import type { RoleId } from '@/types/auth'

/** Únicos roles que reciben el aviso. Cualquier otro rol —y el miembro sin
 *  roles— queda fuera. 'direccion' entró el 2026-08-04 (faltaba). */
export const STUDY_REQUEST_NOTIFY_ROLES: RoleId[] = [
  'coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin',
]

export type RoleRow = {
  member_id: string
  role: string
  /** ¿La asignación del rol está activa? (member_roles.is_active) */
  role_active: boolean
  /** ¿El miembro está activo? (members.is_active) */
  member_active: boolean
}

/**
 * member_id (deduplicados) que deben recibir el aviso.
 * Filtra por rol de la allowlist, rol activo y miembro activo, y excluye al
 * solicitante — nadie necesita el aviso de su propia solicitud.
 */
export function selectStudyRequestRecipients(
  rows: readonly RoleRow[],
  opts: { excludeMemberId?: string | null } = {},
): string[] {
  const allowed = new Set<string>(STUDY_REQUEST_NOTIFY_ROLES)
  const ids = new Set<string>()
  for (const r of rows) {
    if (!allowed.has(r.role)) continue
    if (!r.role_active || !r.member_active) continue
    if (opts.excludeMemberId && r.member_id === opts.excludeMemberId) continue
    ids.add(r.member_id)
  }
  return [...ids]
}

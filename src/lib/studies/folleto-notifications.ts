/**
 * Quién recibe los avisos de folletos (campana + correo).
 *
 * EL BUG, reportado el 2026-09-21: los correos de folletos le llegaban a
 * comunicacion@theosplace.org, que no tiene nada que ver con folletos.
 *
 * La audiencia se derivaba de los PERMISOS: "todo rol que pueda ver el módulo
 * folletos". Y `solo_lectura` tiene `module: 'all'` con `view`, así que
 * calificaba — su razón de ser es justamente poder mirar todo. Con eso entraban
 * comunicacion@ y franchesca@, ninguna de las dos responsable de imprimir nada.
 *
 * Poder VER algo no es ser responsable de eso. Un permiso de lectura existe
 * para que alguien pueda consultar sin estorbar; convertirlo en una lista de
 * correo hace lo contrario. Y la trampa se repite sola: cada rol nuevo con
 * `module: 'all'` se suscribe a estos correos sin que nadie lo decida.
 *
 * Por eso la lista es EXPLÍCITA, igual que `STUDY_REQUEST_NOTIFY_ROLES` — que
 * es el mismo molde y no tuvo este problema.
 */
import type { RoleId } from '@/types/auth'

/**
 * Únicos roles que reciben el aviso. Decisión del usuario 2026-09-21: solo
 * quien tiene el rol `folletos`.
 *
 * `admin` NO está, aunque el módulo se lo abra: hasta hoy entraban ti@ y
 * operaciones@ por esa vía y el pedido fue explícito. Administrar el sistema no
 * es estar a cargo de los folletos; quien quiera el aviso, que tenga el rol.
 */
export const FOLLETO_NOTIFY_ROLES: RoleId[] = ['folletos']

export type FilaDeRol = {
  member_id: string
  role: string
  /** ¿La asignación del rol está activa? (member_roles.is_active) */
  role_active: boolean
  /** ¿El miembro está activo? (members.is_active) */
  member_active: boolean
}

/** member_id (deduplicados) que deben recibir el aviso de folletos. */
export function destinatariosDeFolletos(filas: readonly FilaDeRol[]): string[] {
  const permitidos = new Set<string>(FOLLETO_NOTIFY_ROLES)
  const ids = new Set<string>()
  for (const f of filas) {
    if (!permitidos.has(f.role)) continue
    if (!f.role_active || !f.member_active) continue
    ids.add(f.member_id)
  }
  return [...ids]
}

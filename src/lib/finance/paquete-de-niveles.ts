/**
 * Paquetes de niveles en el esquema VIEJO (2026-10-19, pedido de Floriana:
 * «los paquetes de niveles son comunes»).
 *
 * En legacy cada nivel cobra el suyo, pero hay quien paga varios de una vez
 * —los 8 de Daniela Seas pagaron ₡13.000 por N2+N3+N4—. El pago se registra
 * sobre el cobro pendiente del nivel ACTUAL (que pasa a pagado por el monto
 * del paquete) y los niveles SIGUIENTES quedan anotados en
 * `study_enrollments.niveles_prepagados`, para que al cerrar el grupo el
 * sucesor no los cobre (ver `autoEnrollApprovedToNextLevel`).
 *
 * Solo legacy: en bloques el par ya se cobra junto y la regla es otra.
 * Módulo PURO.
 */
import { nextLevelCode } from '@/lib/studies/folletos'
import { modalidadDe } from '@/lib/studies/modalidad-de-bloques'
import { hasModulePermission } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

/** La cadena desde este nivel hasta el último: N2 → [N2, N3, N4]. */
export function cadenaDesde(planCode: string | null | undefined): string[] {
  const out: string[] = []
  let c = planCode ?? null
  while (c && out.length < 8 && !out.includes(c)) { out.push(c); c = nextLevelCode(c) }
  return out
}

/** ¿Este cobro admite registrar un paquete? Legacy, matrícula pendiente y con nivel siguiente. */
export function admitePaquete(c: {
  modalidad: string | null | undefined
  planCode: string | null | undefined
  concept: string | null | undefined
  status: string
  review_status?: string | null
}): boolean {
  return modalidadDe(c.modalidad) === 'legacy'
    && c.concept === 'matricula'
    && c.status === 'pending'
    && c.review_status !== 'en_revision'
    && cadenaDesde(c.planCode).length >= 2
}

/**
 * Valida los niveles elegidos: tienen que empezar en el actual y seguir la
 * cadena sin saltos (no se paga N4 sin N3). Devuelve los que quedan
 * PREPAGADOS —todos menos el actual, que es el que se está pagando— o el motivo
 * del rechazo.
 */
export function prepagadosDelPaquete(planCode: string, elegidos: readonly string[]): { prepagados: string[] } | { error: string } {
  const cadena = cadenaDesde(planCode)
  if (elegidos.length < 2) return { error: 'Un paquete cubre al menos dos niveles.' }
  if (elegidos[0] !== planCode) return { error: `El paquete empieza en el nivel actual (${planCode}).` }
  for (let i = 0; i < elegidos.length; i++) {
    if (elegidos[i] !== cadena[i]) return { error: 'Los niveles tienen que ir seguidos, sin saltarse ninguno.' }
  }
  return { prepagados: elegidos.slice(1) }
}

export function descripcionDelPaquete(niveles: readonly string[]): string {
  return `Paquete de niveles ${niveles.join(' + ')} (esquema viejo)`
}

/** ¿Puede registrar un paquete? Quien revisa pagos o tiene finanzas (el MISMO permiso del endpoint). */
export function puedeRegistrarPaquete(roles: readonly string[] | null | undefined): boolean {
  return hasModulePermission([...(roles ?? [])] as RoleId[], ['revision_pagos', 'finanzas'], 'edit')
}

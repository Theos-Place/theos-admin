/**
 * BEC-1 · Quién puede aplicarle una beca o un cupón a un cobro.
 *
 * ESTABA ESCRITA SUELTA en `finanzas/pagos/page.tsx`:
 *
 *     const canApplyScholarship = can('becas', 'edit') || canReview
 *
 * Al pedir Floriana la misma acción desde el perfil del miembro (2026-10-09)
 * esa línea iba a quedar en dos pantallas, y dos copias de un permiso se
 * separan: una se aprieta, la otra no, y queda un botón que contesta 403 —o
 * peor, uno que no aparece aunque el endpoint sí dejaría pasar.
 *
 * Es el espejo del guard del endpoint
 * (`requireModuleView(['becas','revision_pagos'], { action: 'edit' })`), y
 * eso es todo lo que es: el endpoint sigue siendo el permiso. Esto decide si
 * se DIBUJA el botón.
 */

import type { RoleId } from '@/types/auth'
import { hasModulePermission } from '@/lib/auth/roles'

export function puedeAplicarBeca(roles: readonly RoleId[] | null | undefined): boolean {
  const lista = [...(roles ?? [])] as RoleId[]
  if (lista.length === 0) return false
  return hasModulePermission(lista, 'becas', 'edit')
    || hasModulePermission(lista, 'revision_pagos', 'edit')
}

/**
 * Un cobro admite beca solo mientras esté PENDIENTE.
 *
 * Sobre uno ya pagado o cerrado, aplicar una beca no le devuelve la plata a
 * nadie: deja el monto cambiado debajo de un pago que ya entró. Eso se
 * resuelve con una devolución, que es otra cosa y tiene su propia pantalla.
 */
export function cobroAdmiteBeca(
  cobro: { queue_status?: string | null; status?: string | null },
): boolean {
  if (cobro.queue_status) return cobro.queue_status === 'pendiente'
  return cobro.status === 'pending'
}

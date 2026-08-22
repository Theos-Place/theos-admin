// FRM-4 · Actuar A NOMBRE DE otra persona, dejando rastro de quién lo hizo.
//
// El caso real: alguien contesta por teléfono o en papel y el staff lo registra.
// La respuesta es de esa persona, pero quién la digitó importa — si después hay
// una duda ("yo nunca dije eso"), sin el rastro no se puede reconstruir nada.
//
// LA CONVENCIÓN, y es la decisión que simplifica todo lo demás: `recordedBy` es
// NULL cuando la persona lo hizo ella misma. Solo se llena cuando el actor es
// distinto del miembro. Así `recorded_by IS NOT NULL` responde exactamente la
// pregunta de la pantalla —"¿esto lo registró el staff?"— sin comparar columnas.

import type { AuthContext } from '@/lib/auth/guard'
import type { RoleId } from '@/types/auth'

export type OnBehalfResult = {
  /** De quién es el registro. */
  memberId: string | null
  /** Quién lo digitó, si NO fue la propia persona. NULL en el caso normal. */
  recordedBy: string | null
  /** true si el actor está registrando por otro. */
  esPorOtro: boolean
}

/**
 * Resuelve a nombre de quién se está actuando y quién lo digita.
 *
 * Espejo de `resolveTargetMemberId` (misma regla anti-suplantación: sin el rol,
 * el `requested` se ignora y queda el propio), pero además devuelve el rastro.
 * Se hizo aparte y no dentro de resolveTargetMemberId para no cambiar la firma
 * de una función que usan cinco endpoints.
 */
export function resolveOnBehalf(
  ctx: AuthContext,
  requested: unknown,
  privilegedRoles: readonly RoleId[],
): OnBehalfResult {
  const propio = ctx.memberId ?? null
  const puede = ctx.roles.includes('admin') || privilegedRoles.some(r => ctx.roles.includes(r))
  const pedido = typeof requested === 'string' && requested ? requested : null

  if (!puede || !pedido || pedido === propio) {
    return { memberId: pedido && puede ? pedido : propio, recordedBy: null, esPorOtro: false }
  }
  return { memberId: pedido, recordedBy: propio, esPorOtro: true }
}

/** Quién puede llenar un FORMULARIO a nombre de otro (FRM-4 punto 2).
 *  El acceso puntual a UN formulario (form_access_grants) se suma aparte: se
 *  resuelve por formulario, no por rol, así que no puede vivir en esta lista. */
export const FORM_ON_BEHALF_ROLES: RoleId[] = ['forms', 'comunicaciones', 'direccion']

/** Quién puede INSCRIBIR a otro en un evento.
 *  Estaba duplicado en dos rutas con contenidos distintos —una incluía 'admin' y
 *  la otra no— así que se centralizó acá al agregarle la UI (FRM-4). `admin` no
 *  va en la lista: resolveOnBehalf ya lo trata aparte, como en el resto. */
export const EVENT_ON_BEHALF_ROLES: RoleId[] = ['direccion', 'encargado_staff', 'comunicaciones']

/** Quién puede crear una SOLICITUD financiera a nombre de otro. */
export const FINANCE_ON_BEHALF_ROLES: RoleId[] = ['finanzas', 'direccion']

/** Etiqueta para la respuesta registrada por alguien más. Se usa en la vista de
 *  respuestas y en el export: la misma frase en los dos lados, para que nadie la
 *  confunda con una respuesta directa. */
export function recordedByLabel(nombre: string | null | undefined): string {
  return `Registrada por ${nombre?.trim() || 'el staff'}`
}

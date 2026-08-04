// Deep link de una notificación a la cola de solicitudes:
// /estudios/solicitudes?tab=<tipo>&request=<id>
//
// Bug 2026-08-04: las notificaciones creadas antes de que el link llevara ?tab=
// (62 en la campana al 2026-08-04) caían en el tab por defecto —prematrimonial—
// y la solicitud enlazada no se abría. Además, un ?tab= que no coincidiera con
// el TIPO de la solicitud dejaba el tablero mostrando la lista equivocada.
//
// Regla única (pura y testeada): el TIPO de la solicitud manda. El ?tab= solo
// se usa mientras no se conoce el tipo (la lista todavía no cargó), y como
// navegación normal cuando no hay ?request=.
//
// EST-6: reubicaciones e intereses viven en tabs separados; esta función nunca
// mezcla los dos tipos.
import type { StudyRequestType } from '@/types/study'

export type RequestSection = 'prematrimonial' | 'relocation' | 'study_interest'

const SECTIONS: RequestSection[] = ['prematrimonial', 'relocation', 'study_interest']

export function isRequestSection(v: unknown): v is RequestSection {
  return typeof v === 'string' && (SECTIONS as string[]).includes(v)
}

/** Link canónico de una notificación hacia una solicitud. */
export function requestDeepLink(type: StudyRequestType, id: string): string {
  return `/estudios/solicitudes?tab=${type}&request=${id}`
}

export function resolveRequestSection(input: {
  /** ?tab= de la URL (puede faltar o venir inválido). */
  tabParam?: string | null
  /** ?request= de la URL. */
  requestId?: string | null
  /** Tipo REAL de la solicitud enlazada, cuando ya se conoce. */
  requestType?: StudyRequestType | null
  /** ¿La persona ve la cola completa? El comité solo tiene reubicaciones. */
  fullQueue: boolean
}): RequestSection {
  // El comité de estudios bíblicos no tiene los otros tabs.
  if (!input.fullQueue) return 'relocation'
  // El tipo de la solicitud enlazada gana sobre cualquier ?tab=.
  if (input.requestId && input.requestType) return input.requestType
  if (isRequestSection(input.tabParam)) return input.tabParam
  // Deep link viejo (?request= sin ?tab=): reubicación es el tipo con flujo de
  // gestión y el que generaba estas notificaciones; al cargar la lista se
  // corrige con el tipo real.
  if (input.requestId) return 'relocation'
  return 'prematrimonial'
}

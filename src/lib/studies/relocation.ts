/**
 * Reubicación: a cuáles estudios se puede pedir volver, y qué compromisos exige
 * cada uno. MÓDULO PURO.
 *
 * Existe porque la lista de estudios estaba escrita TRES veces —el dropdown de
 * StudyRequestActions, el zod de /api/studies/requests y una constante
 * RELOCATION_ELIGIBLE_CODES en eligibility.ts que nadie usa— y las tres no
 * decían lo mismo. La que nadie usa incluye N1, DIS1 y SCJ; las dos vivas, no.
 * Acá queda una sola, con el conjunto que está en producción.
 */
import { requirementsForStage, LEVEL_TO_STAGE } from '@/lib/studies/eligibility'

/** Estudios a los que se puede pedir reubicación. Es el conjunto que ya estaba
 *  en producción (dropdown + validación del POST), ahora en un solo lugar. */
export const RELOCATION_CODES = ['N2', 'N3', 'N4', 'DIS2', 'DIS3'] as const
export type RelocationCode = (typeof RELOCATION_CODES)[number]

export function isRelocationCode(code: string | null | undefined): code is RelocationCode {
  return !!code && (RELOCATION_CODES as readonly string[]).includes(code)
}

/** Lo que se sabe de los compromisos del miembro. Los nombres son los mismos que
 *  usa getEligibleStudiesForMember para no traducir en el medio. */
export type Compromisos = {
  is_donor: boolean
  is_server: boolean
  /** ≥6 charlas en la ventana, con una reciente. */
  attendance_active: boolean
  /** ≥12 charlas: el criterio REFORZADO que pide la etapa intermedia. */
  attendance_active_intermedia: boolean
}

/**
 * ¿Puede reubicarse a ese estudio, y si no, qué le falta?
 *
 * Se miran SOLO los compromisos de la etapa, NO el prerequisito de la cadena.
 * Eso es a propósito: quien pide reubicación ya venía en ese estudio y lo pausó
 * —es el caso que motivó el cambio— así que exigirle otra vez el prerequisito lo
 * dejaría afuera de volver a su propio grupo.
 *
 * En la práctica esto solo restringe la cadena Discípulos: N2/N3/N4 son etapa
 * "niveles" y no piden ningún compromiso.
 */
export function puedeReubicarseA(
  code: string,
  nivelDb: string | null | undefined,
  c: Compromisos,
  /** Requisitos perdonados por una excepción de matrícula activa. */
  eximido: (req: string) => boolean = () => false,
): { is_eligible: boolean; missing: string[] } {
  const stage = LEVEL_TO_STAGE[nivelDb ?? ''] ?? 'niveles'
  const req = requirementsForStage(stage)
  const missing: string[] = []

  if (req.donor && !(c.is_donor || eximido('donor'))) {
    missing.push('ser donante activo')
  }
  if (req.server && !(c.is_server || eximido('server'))) {
    missing.push('servir activamente en un comité')
  }
  if (req.attendance === 'general' && !(c.attendance_active || eximido('attendance'))) {
    missing.push('asistencia activa a las charlas')
  }
  if (req.attendance === 'intermedia' && !(c.attendance_active_intermedia || eximido('attendance'))) {
    missing.push('asistencia activa a las charlas (el doble de la general)')
  }
  return { is_eligible: missing.length === 0, missing }
}

/** El texto que ve la persona. Se arma acá y no en la pantalla para que el
 *  correo, la API y la UI digan lo mismo. */
export function textoFalta(nombreEstudio: string, missing: string[]): string {
  if (missing.length === 0) return ''
  const lista = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(', ')} y ${missing[missing.length - 1]}`
  return `Para estar en ${nombreEstudio} te falta ${lista}.`
}

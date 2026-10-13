/**
 * EST-20 · Qué grupos de Nivel 1 se muestran en la página PÚBLICA.
 *
 * LA REGLA QUE IMPORTA: si acá aparece un grupo que la matrícula interna no
 * ofrece, es un bug. Alguien llega desde redes, ve el grupo, crea una cuenta
 * y al entrar no está — y para esa persona el sistema quedó mal, no el
 * grupo.
 *
 * Los criterios son un SUBCONJUNTO de los de `computeEligibility`: los que
 * no dependen de quién mira. Los que sí dependen de la persona no se pueden
 * evaluar sin sesión, y cada uno se resuelve escondiendo el grupo, nunca
 * mostrándolo:
 *
 *  · EDAD (`age_min`/`age_max`): no se sabe quién mira, así que el grupo SE
 *    MUESTRA con su rango visible. Es el único criterio que se deja pasar, y
 *    a propósito: esconder los grupos con rango dejaría la página casi vacía
 *    —casi todos tienen uno— y el rango es información pública y útil.
 *  · VIRTUALES: adentro se ocultan salvo autorización del miembro. Sin
 *    sesión no hay autorización posible, así que no se muestran.
 *  · RESTRINGIDOS (GRU-2): su audiencia se decide con el historial de la
 *    persona. Sin sesión no se puede, así que no se muestran.
 *
 * Módulo PURO.
 */
import { isEnrollmentWindowOpen } from './enrollment-window'

/** El código del plan que esta página publica. Uno solo, a propósito. */
export const PLAN_PUBLICO = 'N1'

export type GrupoCandidato = {
  id: string
  plan_code: string | null
  status: string | null
  max_students: number | null
  activos: number
  enrollment_start_date: string | null
  enrollment_end_date: string | null
  is_virtual: boolean | null
  has_restriction: boolean
}

export function seMuestraEnPublico(g: GrupoCandidato, hoyYmd: string): boolean {
  if (g.plan_code !== PLAN_PUBLICO) return false
  if (g.status !== 'en_matricula') return false
  if (g.is_virtual) return false
  if (g.has_restriction) return false
  if (!isEnrollmentWindowOpen(g.enrollment_start_date, g.enrollment_end_date, hoyYmd)) return false
  return cuposLibres(g) > 0
}

/** Cupos que quedan. Nunca negativo: un grupo pasado de capacidad muestra 0. */
export function cuposLibres(g: Pick<GrupoCandidato, 'max_students' | 'activos'>): number {
  return Math.max(0, (g.max_students ?? 0) - g.activos)
}

/**
 * Qué tan lleno está, para la barra. 0–1.
 *
 * Sin capacidad declarada devuelve 0 en vez de dividir entre cero: la barra
 * sale vacía y el texto dice los cupos, que es lo que se lee igual.
 */
export function proporcionLlena(g: Pick<GrupoCandidato, 'max_students' | 'activos'>): number {
  const max = g.max_students ?? 0
  if (max <= 0) return 0
  return Math.min(1, g.activos / max)
}

/** «Quedan 3 campos» / «Queda 1 campo» / «Sin campos». */
export function textoDeCupos(g: Pick<GrupoCandidato, 'max_students' | 'activos'>): string {
  const n = cuposLibres(g)
  if (n === 0) return 'Sin campos'
  return n === 1 ? 'Queda 1 campo' : `Quedan ${n} campos`
}

/** El rango de edad, dicho en una línea, o null si el grupo no pide ninguno. */
export function textoDeEdad(g: { age_min?: number | null; age_max?: number | null }): string | null {
  const { age_min: min, age_max: max } = g
  if (min == null && max == null) return null
  if (min != null && max != null) return `De ${min} a ${max} años`
  if (min != null) return `Desde los ${min} años`
  return `Hasta los ${max} años`
}

/**
 * ¿Quién ve el botón de «Copiar enlace público»?
 *
 * Solo admin y coordinación de estudios. El enlace no es secreto —la página
 * es pública— pero difundir la matrícula es una decisión de comunicación, y
 * un botón visible para todos invita a que cada quien la mande por su lado.
 */
export function puedeCompartirEnlacePublico(roles: readonly string[]): boolean {
  return roles.includes('admin') || roles.includes('coordinador_estudios')
}

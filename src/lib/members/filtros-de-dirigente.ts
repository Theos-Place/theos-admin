/**
 * PAR-7 · Los filtros de DIRIGENTE dentro del padrón.
 *
 * POR QUÉ ACÁ Y NO EN LA PANTALLA DE DIRIGENTES. Esa pantalla ya sabe filtrar
 * por estado, formación y disponibilidad, pero lo hace en memoria sobre la
 * lista que ya cargó, y ahí se acaba: no hay listas guardadas, ni columnas, ni
 * export. Todo eso ya existe en el padrón, y lo único que le faltaba eran estas
 * condiciones. Decisión con Floriana (2026-09-25): entran al padrón y la
 * pantalla de dirigentes no cambia.
 *
 * TRES PREGUNTAS DISTINTAS que se parecen y no son lo mismo — es el mismo trío
 * que ya separa la pantalla de dirigentes:
 *   · CAPACITADO para dar  → `study_leaders.formation_study_codes`. Se formó.
 *   · DISPONIBLE para dar  → `study_leaders.qualified_study_codes`. Está
 *     dispuesto AHORA. Medido hoy: 445 fichas tienen las dos listas y NO son
 *     iguales (N4 aparece en 311 formaciones y 269 disponibilidades).
 *   · DANDO ahora          → tiene un grupo a cargo, que vive en
 *     `study_groups.leader_id/co_leader_id` y no en la ficha del dirigente.
 *
 * Módulo PURO: acá viven las reglas y las etiquetas; quien habla con la base es
 * `resolveAdvancedConditions`.
 */
import { expandSelectionValue } from '@/lib/studies/study-grouping'
import { canSeeLeaderAdminStatus } from '@/lib/studies/leader-admin-status'

/**
 * Los estados por los que se puede filtrar.
 *
 * `activo` / `inactivo` salen de `study_leaders.is_active`, que es el
 * automático de PAR-2 (dirige algo ahora, o dirigió en los últimos 12 meses).
 * `pausa` y `en_revision` son ETIQUETAS administrativas que viven en
 * `availability_status` (DIR-6) y son ortogonales: hoy en producción el único
 * `en_revision` está además activo, y el único `resting` está inactivo.
 *
 * Por eso la selección es MÚLTIPLE y los estados NO son excluyentes: «activos
 * más los que están en pausa» es una pregunta legítima y con una lista de
 * radios sería imposible.
 */
export const ESTADOS_DE_DIRIGENTE = ['activo', 'inactivo', 'pausa', 'en_revision'] as const
export type EstadoDeDirigente = typeof ESTADOS_DE_DIRIGENTE[number]

export const ESTADO_DE_DIRIGENTE_LABEL: Record<EstadoDeDirigente, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  pausa: 'En pausa',
  en_revision: 'En revisión',
}

/**
 * Los dos que NO ve cualquiera.
 *
 * «En revisión» dice que hay una situación abierta con una persona, y «en
 * pausa» que hay un acuerdo administrativo: es la misma confidencialidad que
 * ya decidió DIR-6, donde fuera del grupo que gestiona dirigentes los dos
 * colapsan a «inactivo». Traerlos al padrón sin la misma puerta sería abrir por
 * la ventana lo que se cerró por la puerta — y el padrón lo ve más gente, entre
 * ella `direccion`, que está fuera de `LEADER_ADMIN_ROLES` a propósito.
 */
export const ESTADOS_RESERVADOS: readonly EstadoDeDirigente[] = ['pausa', 'en_revision']

/** Los estados que esta sesión puede siquiera nombrar. */
export function estadosVisibles(roles: readonly string[] | null | undefined): EstadoDeDirigente[] {
  return canSeeLeaderAdminStatus(roles)
    ? [...ESTADOS_DE_DIRIGENTE]
    : ESTADOS_DE_DIRIGENTE.filter(e => !ESTADOS_RESERVADOS.includes(e))
}

/**
 * Los estados de una condición, ya saneados para esta sesión.
 *
 * Devolver la lista filtrada y no un booleano «puede/no puede» es a propósito:
 * si alguien arma a mano una condición con `['activo','en_revision']`, lo
 * correcto es responder por los activos y no por los dos, ni negarse a
 * responder. El que no tiene permiso simplemente no ve esa parte de la
 * pregunta.
 */
export function estadosPermitidos(
  pedidos: readonly string[] | null | undefined,
  puedeVerReservados: boolean,
): EstadoDeDirigente[] {
  const validos = (pedidos ?? []).filter((e): e is EstadoDeDirigente =>
    (ESTADOS_DE_DIRIGENTE as readonly string[]).includes(e))
  const unicos = [...new Set(validos)]
  return puedeVerReservados ? unicos : unicos.filter(e => !ESTADOS_RESERVADOS.includes(e))
}

/** Cómo se lee cada estado en la ficha de `study_leaders`. */
export type FichaDeDirigente = {
  is_active: boolean | null
  availability_status: string | null
}

/**
 * ¿Esta ficha cae en alguno de los estados pedidos? (OR, no AND).
 *
 * Es el espejo puro de lo que hace el servidor con consultas, y existe para
 * poder probar la combinación no excluyente sin base de datos.
 */
export function pasaEstadoDeDirigente(
  ficha: FichaDeDirigente,
  estados: readonly EstadoDeDirigente[],
): boolean {
  if (estados.length === 0) return false
  return estados.some(e => {
    if (e === 'activo') return ficha.is_active === true
    if (e === 'inactivo') return ficha.is_active === false
    if (e === 'pausa') return ficha.availability_status === 'resting'
    return ficha.availability_status === 'en_revision'
  })
}

/** `availability_status` que corresponde a una etiqueta administrativa. */
export const AVAILABILITY_DE_ETIQUETA: Record<'pausa' | 'en_revision', string> = {
  pausa: 'resting',
  en_revision: 'en_revision',
}

/**
 * Los códigos de estudio reales detrás de lo que se eligió en el selector.
 *
 * El selector ofrece «Niveles» y «Discípulos» como una sola opción (`GRP:…`)
 * porque así piensan los dirigentes, pero la base guarda N1…N4 y DIS1…DIS3. La
 * expansión es la MISMA de la pantalla de dirigentes (`expandSelectionValue`),
 * no una copia: si algún día se agrega un nivel, se agrega en un solo lugar.
 *
 * Vacío = la condición no filtra por estudio (aplica a cualquiera).
 */
export function codigosDeSeleccion(valores: readonly string[] | null | undefined): string[] {
  return [...new Set((valores ?? []).flatMap(v => expandSelectionValue(v)).filter(Boolean))]
}

/** Etiqueta corta del chip: hasta dos nombres y «+N» — un chip con ocho
 *  códigos no se lee y empuja a la X fuera de la tarjeta. */
export function resumenDeSeleccion(
  valores: readonly string[],
  etiquetaDe: (valor: string) => string,
): string {
  if (valores.length === 0) return 'cualquier estudio'
  const nombres = valores.map(etiquetaDe)
  if (nombres.length <= 2) return nombres.join(' o ')
  return `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2}`
}

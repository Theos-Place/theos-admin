/**
 * ¿La persona puede USAR la beca que le aprobaron?
 *
 * El caso que lo pidió: a Karla Ávila y a María José Ruiz les aprobaron una
 * beca del 100% para Romanos y el único grupo abierto se llenó. Tienen una
 * beca viva que no pueden aplicar, y nadie se entera hasta que la persona
 * escribe preguntando.
 *
 * Distinguir LLENO de SIN GRUPOS es el punto, no un matiz: un plan sin ningún
 * grupo abierto puede abrir uno la otra semana y no hay nada que hacer hoy;
 * uno lleno hay que resolverlo ya, moviendo la beca o abriendo cupo. Mezclarlos
 * en un solo "sin cupo" convierte la cola en ruido.
 */

export type GrupoDelDestino = {
  /** Nulo = sin tope. Un grupo sin tope nunca está lleno. */
  max_students: number | null
  /** Inscritos que ocupan campo: 'enrolled' + 'pendiente_de_pago'. */
  inscritos: number
}

export type EstadoDelCupo =
  /** Hay al menos un grupo abierto con campo. Todo bien. */
  | 'con_cupo'
  /** Hay grupos abiertos y TODOS están llenos. Pide acción hoy. */
  | 'lleno'
  /** No hay ningún grupo en matrícula. Puede abrir uno; no hay nada que hacer. */
  | 'sin_grupos'
  /** La beca no apunta a un plan de estudio (es de un evento) o ya se usó. */
  | 'no_aplica'

export function hayCampo(g: GrupoDelDestino): boolean {
  return g.max_students === null || g.max_students <= 0 || g.inscritos < g.max_students
}

export function estadoDelCupo(grupos: GrupoDelDestino[]): EstadoDelCupo {
  if (grupos.length === 0) return 'sin_grupos'
  return grupos.some(hayCampo) ? 'con_cupo' : 'lleno'
}

/**
 * Solo una beca viva, sin usar y hacia un PLAN puede quedarse sin cupo. Una de
 * evento no tiene grupos, y una ya usada no le sirve a nadie en una cola.
 *
 * El valor de `entity_type` es 'study_plan', que es lo que hay en la BD — el
 * dominio en español no llega hasta acá.
 */
export function aplicaLaRevision(b: {
  status: string; used_count: number; entity_type: string; plan_id: string | null
}): boolean {
  return b.status === 'active' && b.used_count === 0 && b.entity_type === 'study_plan' && !!b.plan_id
}

export const ETIQUETA_CUPO: Record<EstadoDelCupo, string> = {
  con_cupo: 'Con cupo',
  lleno: 'Sin cupo en el destino',
  sin_grupos: 'Sin grupos abiertos',
  no_aplica: '—',
}

/** Coral solo para lo que pide acción hoy; ámbar para lo que hay que vigilar. */
export const BADGE_CUPO: Record<EstadoDelCupo, string> = {
  con_cupo: 'bg-teal-soft/30 text-teal-deep',
  lleno: 'bg-coral-soft/20 text-coral',
  sin_grupos: 'bg-amber-50 text-amber-700',
  no_aplica: 'bg-navy/5 text-navy-light/80',
}

export const AYUDA_CUPO: Record<EstadoDelCupo, string> = {
  con_cupo: 'Hay al menos un grupo en matrícula con campo.',
  lleno: 'Todos los grupos abiertos del destino están llenos: hay que mover la beca o abrir cupo.',
  sin_grupos: 'El destino no tiene ningún grupo en matrícula. Puede abrirse uno más adelante.',
  no_aplica: 'Esta beca no depende del cupo de un grupo.',
}

export type FiltroCupo = EstadoDelCupo | 'todas'

/** "Sin cupo" primero: es la única que pide acción hoy. */
export const FILTROS_CUPO: Array<{ id: FiltroCupo; label: string }> = [
  { id: 'lleno', label: 'Sin cupo' },
  { id: 'sin_grupos', label: 'Sin grupos abiertos' },
  { id: 'todas', label: 'Todas' },
]

export function conteosPorCupo(estados: EstadoDelCupo[]): Record<FiltroCupo, number> {
  const c: Record<FiltroCupo, number> = {
    con_cupo: 0, lleno: 0, sin_grupos: 0, no_aplica: 0, todas: estados.length,
  }
  for (const e of estados) c[e]++
  return c
}

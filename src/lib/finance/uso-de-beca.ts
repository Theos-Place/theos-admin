/**
 * El TAG de una beca asignada: aprobada y sin usar, ya usada, o revocada.
 *
 * Por qué no se lee `status` y ya: para finanzas la pregunta no es en qué
 * estado está la fila, es "¿esta plata ya se gastó o sigue prometida?". Una
 * beca 'active' es un compromiso vivo que todavía no se aplicó — y son
 * exactamente las que hay que revisar cuando un estudio se llena o se cancela.
 *
 * `used_count` entra al cálculo porque una beca puede tener redenciones
 * registradas: si las tiene, se usó, aunque el status haya quedado atrás.
 *
 * BEC-4: ese conteo llega de verdad para CUALQUIER beca. Por diseño solo los
 * cupones genéricos dejan fila en scholarship_redemptions —una asignada se
 * consume marcándose status='used'— pero la consulta ya no filtra por kind, así
 * que si alguna vez una asignada tiene redención, acá se ve. Antes llegaba
 * siempre en 0 para las asignadas y esta rama era letra muerta: la beca podía
 * estar bloqueada para moverse y decir "Sin usar" en la misma pantalla.
 */

export type Uso = 'sin_usar' | 'usada' | 'revocada'
export type FiltroUso = Uso | 'todas'

export type BecaConUso = {
  status: 'active' | 'used' | 'revoked'
  used_count: number
}

export function usoDeLaBeca(b: BecaConUso): Uso {
  if (b.status === 'revoked') return 'revocada'
  if (b.status === 'used' || b.used_count > 0) return 'usada'
  return 'sin_usar'
}

export const ETIQUETA_USO: Record<Uso, string> = {
  sin_usar: 'Sin usar',
  usada: 'Usada',
  revocada: 'Revocada',
}

/** Verde = plata ya aplicada; ámbar = compromiso vivo pendiente; coral = anulada. */
export const BADGE_USO: Record<Uso, string> = {
  sin_usar: 'bg-amber-50 text-amber-700',
  usada: 'bg-teal-soft/30 text-teal-deep',
  revocada: 'bg-coral-soft/20 text-coral',
}

/** El orden importa: "Sin usar" primero porque es la única que pide acción. */
export const FILTROS_USO: Array<{ id: FiltroUso; label: string }> = [
  { id: 'sin_usar', label: 'Sin usar' },
  { id: 'usada', label: 'Usadas' },
  { id: 'revocada', label: 'Revocadas' },
  { id: 'todas', label: 'Todas' },
]

export function coincideUso(b: BecaConUso, filtro: FiltroUso): boolean {
  return filtro === 'todas' || usoDeLaBeca(b) === filtro
}

export function filtrarPorUso<T extends BecaConUso>(becas: T[], filtro: FiltroUso): T[] {
  return becas.filter(b => coincideUso(b, filtro))
}

/** Conteos sobre la lista COMPLETA: si se contara la ya filtrada, las demás
 *  pastillas mostrarían cero apenas se elige una. */
export function conteosPorUso(becas: BecaConUso[]): Record<FiltroUso, number> {
  const c: Record<FiltroUso, number> = { sin_usar: 0, usada: 0, revocada: 0, todas: becas.length }
  for (const b of becas) c[usoDeLaBeca(b)]++
  return c
}

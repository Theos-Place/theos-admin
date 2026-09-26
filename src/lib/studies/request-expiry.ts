/**
 * Cuándo una solicitud de estudio queda VENCIDA.
 *
 * LA REGLA (2026-09-08): una solicitud sirve para el bloque de matrícula que le
 * toca. Cuando ese bloque cierra su matrícula, la solicitud ya no puede
 * atenderse: la persona tiene que volver a pedirla en el bloque siguiente.
 *
 * SOLO VENCEN LAS ABIERTAS. Una 'in_review' la tiene alguien del comité
 * asignada y trabajándola; vencerla sola le borraría el trabajo sin avisarle.
 * Esas se resuelven o se rechazan a mano.
 *
 * CUÁL ES "SU" BLOQUE, que es la parte que no es obvia. No es el bloque abierto
 * cuando se creó: hay solicitudes hechas ENTRE bloques. En producción hay varias
 * del 25 de agosto, cuando el Bloque 2 ya había cerrado (22 de mayo) y el
 * Bloque 3 todavía no abría (31 de agosto). Atarlas al bloque anterior las
 * vencería de inmediato, cuando en realidad la persona está pidiendo para el
 * que viene.
 *
 * Por eso el bloque de una solicitud es EL PRIMERO cuya matrícula todavía no
 * había cerrado cuando se creó — o sea, el próximo que puede atenderla.
 *
 * REU-2 (2026-09-25) · UNA SOLICITUD QUE DURMIÓ NO ES UNA SOLICITUD VIEJA.
 * Con el estado `en_espera`, una reubicación puede pasar cuatro meses guardada
 * a propósito y volver a la cola. Si el bloque se siguiera calculando desde
 * `created_at`, esa solicitud despertaría y el cron la vencería en la siguiente
 * corrida por vieja: justo la que alguien decidió conservar, y muerta por la
 * decisión que la salvó. Por eso la fecha de referencia es `reactivated_at`
 * cuando existe — desde que volvió, la solicitud está pidiendo para el bloque
 * que viene, igual que una recién creada.
 */

export type BloqueMatricula = {
  id: string
  nombre: string
  /** ISO. Cuando cierra la matrícula de ese bloque. */
  fecha_cierre_matricula: string | null
}

export type SolicitudParaVencer = {
  id: string
  status: string
  /** ISO. */
  created_at: string
  /** ISO. REU-2: cuándo volvió de estar en espera. Manda sobre `created_at`. */
  reactivated_at?: string | null
}

/** Desde cuándo cuenta esta solicitud. Ver REU-2 arriba. */
export function fechaDeReferencia(s: Pick<SolicitudParaVencer, 'created_at' | 'reactivated_at'>): string {
  const r = s.reactivated_at ?? ''
  return r && !Number.isNaN(Date.parse(r)) ? r : s.created_at
}

/** Solo este estado vence solo. */
export const ESTADO_QUE_VENCE = 'open'
export const ESTADO_VENCIDA = 'vencida'

/** El bloque que puede atender esta solicitud: el primero cuya matrícula no
 *  había cerrado todavía cuando se creó. null si no hay ninguno (la solicitud
 *  es más nueva que todos los bloques cargados → no vence). */
export function bloqueQueLaAtiende(
  creadaIso: string,
  bloques: readonly BloqueMatricula[],
): BloqueMatricula | null {
  const creada = Date.parse(creadaIso)
  if (Number.isNaN(creada)) return null
  const conCierre = bloques
    .filter(b => b.fecha_cierre_matricula && !Number.isNaN(Date.parse(b.fecha_cierre_matricula)))
    .sort((a, b) => Date.parse(a.fecha_cierre_matricula!) - Date.parse(b.fecha_cierre_matricula!))
  return conCierre.find(b => Date.parse(b.fecha_cierre_matricula!) >= creada) ?? null
}

/** ¿Ya venció? Abierta, con un bloque que la atendía, y ese bloque ya cerró. */
export function estaVencida(
  solicitud: SolicitudParaVencer,
  bloques: readonly BloqueMatricula[],
  ahora: Date = new Date(),
): boolean {
  if (solicitud.status !== ESTADO_QUE_VENCE) return false
  const bloque = bloqueQueLaAtiende(fechaDeReferencia(solicitud), bloques)
  if (!bloque?.fecha_cierre_matricula) return false
  return ahora.getTime() > Date.parse(bloque.fecha_cierre_matricula)
}

/** Las que hay que vencer de una tanda. Devuelve el motivo para el log del
 *  cron: sin esto, "vencí 22 solicitudes" no dice por cuál bloque. */
export function solicitudesAVencer(
  solicitudes: readonly SolicitudParaVencer[],
  bloques: readonly BloqueMatricula[],
  ahora: Date = new Date(),
): Array<{ id: string; bloque: string }> {
  const out: Array<{ id: string; bloque: string }> = []
  for (const s of solicitudes) {
    if (!estaVencida(s, bloques, ahora)) continue
    out.push({ id: s.id, bloque: bloqueQueLaAtiende(fechaDeReferencia(s), bloques)!.nombre })
  }
  return out
}

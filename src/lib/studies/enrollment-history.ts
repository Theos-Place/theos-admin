/**
 * Qué sale en el historial de estudios de una persona, y cómo se llama.
 *
 * Dos cosas que estaban mal hasta el 2026-09-02:
 *
 * 1) La ficha traducía `dropped: 'Reprobó'`. Un retiro NO es una reprobación:
 *    quien se sale de un estudio por un cambio de horario no perdió nada, y
 *    ponerle "Reprobó" en el expediente es acusarlo de algo que no pasó.
 *
 * 2) Las matrículas canceladas —las que nunca llegaron a darse— aparecían en
 *    el historial, y también como "Reprobó". A Karina Padilla se le venció el
 *    plazo para subir el comprobante y su ficha decía que había reprobado
 *    "Cómo Tomar Buenas Decisiones", un estudio que nunca cursó.
 *
 * La regla: una matrícula cancelada no ocurrió, así que no se muestra. Y nada
 * que no sea una reprobación registrada dice "Reprobó".
 */

/** Estados que NO se muestran en el historial: matrículas que no ocurrieron. */
const NO_OCURRIERON = ['cancelada', 'expirada', 'pendiente_de_pago'] as const

/** ¿Esta inscripción sale en el historial de estudios de la persona? */
export function apareceEnHistorial(status: string | null | undefined): boolean {
  const s = (status ?? '').trim()
  if (!s) return false
  return !(NO_OCURRIERON as readonly string[]).includes(s)
}

/**
 * Cómo se lee el estado en la ficha.
 *
 * 'dropped' es "Se retiró", nunca "Reprobó" — son cosas distintas y solo una
 * de las dos es un juicio sobre el desempeño de la persona.
 */
export const ESTADO_HISTORIAL: Record<string, string> = {
  completed: 'Aprobado',
  reprobado: 'Reprobó',
  dropped: 'Se retiró',
  enrolled: 'En curso',
  en_revision: 'Por confirmar',
  waitlist: 'En espera',
  transferred: 'Transferido',
  cancelada: 'Matrícula cancelada',
  expirada: 'Matrícula vencida',
  pendiente_de_pago: 'Pendiente de pago',
}

export function etiquetaHistorial(status: string | null | undefined): string {
  const s = (status ?? '').trim()
  return ESTADO_HISTORIAL[s] ?? s ?? '—'
}

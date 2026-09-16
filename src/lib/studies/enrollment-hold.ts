/**
 * Cuánto se le guarda el cupo a quien empezó a matricularse y no terminó.
 *
 * EL PROBLEMA. Desde el 2026-09-01 una matrícula con costo nace
 * 'pendiente_de_pago' y la confirma el comprobante. Eso arregla el caso de
 * quien se arrepiente —ahora puede cancelar—, pero deja otro: el que cierra el
 * navegador, se queda sin batería o simplemente no vuelve. Esa matrícula queda
 * ocupando cupo para siempre y nadie se entera.
 *
 * LA REGLA: sin comprobante después de la ventana de gracia, la reserva se
 * suelta. La matrícula pasa a 'dropped', su cobro se cancela y el cupo queda
 * libre. La persona puede volver a matricularse cuando quiera.
 *
 * LO QUE NO SE TOCA, y es la razón de que la condición sea por ESTADO y no por
 * "tiene un pago pendiente": las matrículas AUTOMÁTICAS del cierre (N2, N3, N4
 * y la cadena de Discípulos) nacen 'enrolled' con un cobro aparte. Esas sí
 * pueden convivir con un pago pendiente indefinidamente: a esa persona no la
 * puso nadie en un flujo a medias, la matriculó el sistema al aprobar el nivel
 * anterior, y quitarle el cupo por no haber pagado todavía sería sacarla de una
 * cohorte que ya avanzó con ella.
 */

/** Ventana de gracia. 24 horas: quien paga por SINPE en el momento sube el
 *  comprobante en minutos, y quien paga de noche tiene la mañana siguiente. */
export const HORAS_DE_GRACIA = 24

/**
 * ¿Se le suelta el cupo?
 *
 * `reviewStatus` no nulo significa que YA mandó algo —está en revisión, o se lo
 * rechazaron y puede resubir—. Eso no es abandono: esos casos los maneja
 * finanzas, no un barrido automático.
 */
export function reservaExpirada(input: {
  status: string
  /** review_status del pago de matrícula, o null si nunca subió nada. */
  reviewStatus: string | null | undefined
  /** Desde cuándo corre la gracia (ISO). Sale de `relojDeLaReserva`, NO del
   *  created_at de la matrícula: ver el comentario de esa función. */
  creadaEn: string
  ahora: Date
}): boolean {
  if (input.status !== 'pendiente_de_pago') return false
  if (input.reviewStatus) return false
  const creada = Date.parse(input.creadaEn)
  if (!Number.isFinite(creada)) return false
  return input.ahora.getTime() - creada >= HORAS_DE_GRACIA * 3600_000
}

export const MOTIVO_EXPIRADA =
  `Matrícula sin comprobante por más de ${HORAS_DE_GRACIA} horas: se liberó el cupo automáticamente`

/** Un pago de matrícula, con lo poco que hace falta para fechar la reserva. */
export type PagoDeMatricula = {
  concept: string | null
  status: string | null
  review_status: string | null
  created_at: string
}

/**
 * ¿Desde cuándo corre la ventana de gracia de ESTA reserva?
 *
 * EL BUG QUE ARREGLA (2026-09-16, María José Ruiz). Antes se usaba el
 * `created_at` de la fila de `study_enrollments`. Pero la matrícula se guarda
 * con un `upsert` sobre (group_id, member_id): cuando alguien que se dio de
 * baja vuelve al grupo, la fila NO es nueva, se reutiliza — y su `created_at`
 * sigue siendo el del primer intento. Así que una matrícula recién hecha nacía
 * con días de antigüedad y el siguiente barrido la mataba.
 *
 * Le pasó a ella: se rematriculó a las 15:53 y a las 16:00 el cron la botó
 * diciéndole que habían pasado 24 horas. Habían pasado siete minutos.
 *
 * El reloj correcto es el del COBRO pendiente, que sí se crea de cero en cada
 * matrícula — y además es el que describe la regla de verdad: "24 horas desde
 * que se te pidió el comprobante". Si no hay cobro pendiente se cae al
 * created_at de la matrícula, que es el comportamiento viejo.
 */
export function relojDeLaReserva(input: {
  enrollmentCreatedAt: string
  pagos: PagoDeMatricula[] | null | undefined
}): string {
  const pendientes = (input.pagos ?? [])
    .filter(p => p.concept === 'matricula' && p.status === 'pending')
    .map(p => p.created_at)
    .filter(d => Number.isFinite(Date.parse(d)))
    .sort()
  // El MÁS RECIENTE: si quedó un cobro viejo colgando de un intento anterior,
  // fechar la reserva con él la mataría igual que el bug que esto arregla.
  return pendientes.length ? pendientes[pendientes.length - 1] : input.enrollmentCreatedAt
}

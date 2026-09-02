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
  /** Cuándo se creó la matrícula (ISO). */
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

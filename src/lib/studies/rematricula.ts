/**
 * Qué hacer cuando alguien se matricula en un grupo donde YA está.
 *
 * EL BUG (2026-09-16). `enrollMember` guarda con un upsert sobre
 * (group_id, member_id). Si la persona ya estaba matriculada, la fila se REUSA
 * y se le pisa el status — y como la matrícula con costo nace
 * 'pendiente_de_pago', a alguien que ya estaba adentro Y AL DÍA la segunda
 * corrida lo devolvía a deber, más un cobro nuevo por el monto completo.
 *
 * Le pasó a tres personas, todas en menos de un minuto entre un paso y otro:
 *
 *   Daniel Alfaro   13-set  22:23:56 pagó y quedó enrolled
 *                           22:24:53 se rematriculó → pendiente_de_pago + ₡20.000
 *   Alberto Vargas  11-set  18:32:12 pagó y quedó enrolled
 *                           18:33:06 se rematriculó → pendiente_de_pago + ₡20.000
 *   Yanil Gutiérrez 08-set  ya tenía un cobro vivo y le nació un segundo
 *
 * En pantalla se ve como si se hubieran desmatriculado, que fue justo como lo
 * reportaron.
 *
 * Los dos daños son distintos y por eso hay dos decisiones: retroceder a quien
 * ya está adentro, y cobrarle de nuevo a quien ya tiene un cobro abierto.
 *
 * Lo que esto NO toca: reincorporar a alguien 'dropped' o 'cancelada'. Ahí la
 * persona NO está en el grupo, la matrícula tiene que rehacerse de verdad y el
 * cobro nuevo corresponde.
 */

export type PagoDeLaMatricula = { id: string; concept: string | null; status: string | null }

export type DecisionDeRematricula =
  /** Matricular normal (primera vez, o reincorporación de una baja). */
  | { accion: 'seguir' }
  /** Ya está adentro y al día: no se escribe nada. */
  | { accion: 'nada_que_hacer' }
  /** Ya tiene un cobro abierto por esta matrícula: se reusa, no se crea otro. */
  | { accion: 'reusar_cobro'; pagoId: string }

/** Los cobros de matrícula que siguen vivos, del más viejo al más nuevo. */
function cobrosVivos(pagos: readonly PagoDeLaMatricula[]) {
  return pagos.filter(p => p.concept === 'matricula' && (p.status === 'paid' || p.status === 'pending'))
}

export function decidirRematricula(input: {
  /** Estado de la matrícula que YA existe en ese grupo, o null si no hay. */
  estadoActual: string | null | undefined
  /** Pagos colgados de esa matrícula. */
  pagos: readonly PagoDeLaMatricula[]
  /** ¿El plan cobra? (ya resuelto: dirigente, beca total y reubicación lo apagan). */
  requierePago: boolean
}): DecisionDeRematricula {
  const { estadoActual, requierePago } = input
  if (estadoActual !== 'enrolled' && estadoActual !== 'pendiente_de_pago') return { accion: 'seguir' }

  const vivos = cobrosVivos(input.pagos)
  const pagado = vivos.find(p => p.status === 'paid')

  // Ya está adentro y no debe nada. Volver a correr esto solo puede empeorarlo.
  if (estadoActual === 'enrolled' && (!requierePago || pagado)) return { accion: 'nada_que_hacer' }

  // Debe, pero el cobro YA existe. Crear otro es la deuda duplicada.
  const pendiente = vivos.find(p => p.status === 'pending')
  if (pendiente) return { accion: 'reusar_cobro', pagoId: pendiente.id }

  return { accion: 'seguir' }
}

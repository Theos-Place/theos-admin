/**
 * DEV-2 · La coordinación de estudios pide una devolución sin ver pagos.
 *
 * EL ACUERDO, y es lo que explica todo el diseño (Ari + María José): quien
 * pide elige la MATRÍCULA y escribe por qué; quien paga encuentra el pago y
 * verifica el ingreso. Doble chequeo. Por eso esta pantalla no muestra ni
 * montos ni métodos ni ids de pago, y por eso la solicitud nace en `pending`
 * y no resuelta: `pending` es exactamente «finanzas todavía no la revisó», y
 * resolverla sigue siendo de finanzas (`refunds-scope`: `canResolve` es solo
 * de ellos).
 *
 * EL PAGO LO RESUELVE EL SERVIDOR, y se puede porque los datos lo permiten.
 * Medido el 2026-09-30 sobre producción: **ninguna matrícula tiene más de un
 * pago devolvible** —234 tienen exactamente uno y las demás ninguno—. Así que
 * no hay que elegir entre varios ni inventar un estado intermedio, ni tocar el
 * esquema de `refunds` para guardar una solicitud sin pago. Si algún día
 * apareciera una matrícula con dos, `motivoQueImpideSolicitar` lo frena en vez
 * de adivinar.
 *
 * Módulo PURO: el llamador trae los datos, la decisión vive acá.
 */
import type { RoleId } from '@/types/auth'
import { REFUND_STUDY_ROLES } from '@/lib/auth/refunds-scope'

/**
 * Quién puede pedirla.
 *
 * Es la MISMA lista que ya ve las devoluciones de estudios en la cola
 * (`REFUND_STUDY_ROLES`), más admin. Coherente a propósito: quien va a poder
 * seguir la solicitud es quien puede crearla, y usar una lista aparte haría
 * que alguien pudiera pedir algo que después no puede mirar.
 *
 * Finanzas NO está acá y no es un olvido: ellos crean la devolución
 * directamente desde el pago, que es su camino y tiene el monto a la vista.
 */
export const PUEDEN_SOLICITAR_DEVOLUCION: readonly RoleId[] = [...REFUND_STUDY_ROLES, 'admin']

export function puedeSolicitarDevolucion(roles: readonly string[] | null | undefined): boolean {
  if (!roles) return false
  return roles.some(r => (PUEDEN_SOLICITAR_DEVOLUCION as readonly string[]).includes(r))
}

/** Los estados de un pago sobre los que se puede pedir una devolución. Son
 *  los mismos que acepta el RPC `create_refund` — si acá dijera otra cosa, la
 *  pantalla ofrecería matrículas que el servidor después rechaza. */
export const PAGOS_DEVOLVIBLES: readonly string[] = ['paid', 'partial_refund']

/** Estados de una devolución que todavía «ocupan» el pago: mientras exista
 *  una así, pedir otra sobre el mismo pago es duplicar. `rejected` y
 *  `convertida_donacion` no cuentan — ese dinero ya no está en camino. */
export const DEVOLUCIONES_VIVAS: readonly string[] = ['pending', 'processing', 'completed']

export type MatriculaParaDevolver = {
  enrollment_id: string
  /** Cuántos pagos devolvibles tiene. Se cuenta, no se asume. */
  pagosDevolvibles: number
  /** ¿Ya hay una devolución viva sobre ese pago? */
  yaTieneDevolucion: boolean
}

/**
 * null = se puede pedir. Si no, el motivo EN PALABRAS que se le muestra a
 * quien pide.
 *
 * Los mensajes no nombran montos ni pagos: quien lee esto no tiene acceso a
 * pagos y decirle «el pago de ₡45.000 ya fue devuelto» sería justamente
 * dárselo por la puerta de atrás.
 */
export function motivoQueImpideSolicitar(m: MatriculaParaDevolver): string | null {
  if (m.pagosDevolvibles === 0) {
    return 'Esta matrícula no tiene ningún pago cobrado, así que no hay nada que devolver.'
  }
  if (m.pagosDevolvibles > 1) {
    // No pasó nunca en producción (medido el 2026-09-30) y por eso no se
    // resuelve acá: elegir uno de dos pagos es una decisión de finanzas, no
    // una que el sistema pueda tomar sin ver el detalle.
    return 'Esta matrícula tiene más de un pago cobrado. Pedísela a finanzas directamente, '
      + 'que ellos ven cuál corresponde.'
  }
  if (m.yaTieneDevolucion) {
    return 'Ya hay una devolución en curso para esta matrícula.'
  }
  return null
}

/** Mínimo y máximo de la justificación. Mismos números que la razón de una
 *  excepción de matrícula (`exception-reason`): las dos son la misma clase de
 *  decisión discrecional y quien las escribe es la misma persona. */
export const JUSTIFICACION_MIN = 10
export const JUSTIFICACION_MAX = 500

/** null = sirve. Si no, qué le falta. */
export function validarJustificacion(texto: string | null | undefined): string | null {
  const t = (texto ?? '').trim()
  if (t.length === 0) return 'Escribí por qué se pide la devolución.'
  if (t.length < JUSTIFICACION_MIN) {
    return `La justificación es muy corta: contá en una frase por qué se devuelve `
      + `(mínimo ${JUSTIFICACION_MIN} caracteres).`
  }
  if (t.length > JUSTIFICACION_MAX) {
    return `La justificación no puede pasar de ${JUSTIFICACION_MAX} caracteres.`
  }
  return null
}

/**
 * El texto que queda en `refunds.reason`.
 *
 * Lleva el nombre de quien la pidió PEGADO a la justificación, y no solo en
 * el audit_log: quien la resuelve la lee en su cola, no en la auditoría, y
 * necesita saber a quién preguntarle sin salir de la pantalla.
 */
export function razonDeLaSolicitud(input: {
  justificacion: string
  solicitanteNombre: string
  estudio?: string | null
}): string {
  const estudio = input.estudio?.trim()
  return [
    `Solicitada por ${input.solicitanteNombre} (coordinación de estudios)`,
    estudio ? `Estudio: ${estudio}` : null,
    input.justificacion.trim(),
  ].filter(Boolean).join(' · ')
}

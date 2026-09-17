/**
 * Avisarle a la persona que su matrícula está por vencer, y avisarle si se
 * venció (NOT-2).
 *
 * POR QUÉ A LAS 48 HORAS Y NO AL MATRICULARSE. El aviso al crear la matrícula
 * YA EXISTIÓ y se quitó a propósito el 2026-09-01, con la medición al lado:
 * apenas vuelve la función la UI abre el modal del comprobante, la persona lo
 * sube en el momento y el pago pasa a revisión — con la notificación diciéndole
 * que debe algo que ya pagó. De los 4 comprobantes de matrícula que existían,
 * los 4 se subieron en menos de 10 minutos (promedio 3). O sea 4 de 4 avisos
 * equivocados.
 *
 * Con la ventana en 72 horas hay lugar para un aviso que SÍ sirve: a las 48,
 * cuando quedan 24 y todavía se puede hacer algo. Decisión del usuario el
 * 2026-09-17.
 *
 * El aviso es in-app (la campanita), no correo: no depende de
 * EMAIL_SILENT_MODE ni gasta envíos.
 */
import { HORAS_DE_GRACIA } from './enrollment-hold'

/** A las 48 de 72: quedan 24 horas para subir el comprobante. */
export const HORAS_PARA_AVISAR = 48

export const TIPO_AVISO = 'matricula_por_vencer'
export const TIPO_LIBERADA = 'matricula_liberada'

/**
 * ¿Le toca el aviso a esta matrícula?
 *
 * Las exclusiones son las mismas del barrido, y por la misma razón: a quien no
 * se le va a soltar el cupo no hay que asustarlo.
 */
export function necesitaAviso(input: {
  /** Horas desde que nació el cobro (el mismo reloj que usa el barrido). */
  horas: number
  /** review_status del pago: si subió algo, ya cumplió. */
  reviewStatus: string | null | undefined
  conPlanDePagos?: boolean
  /** ¿Ya se le avisó de ESTA matrícula? El aviso es una sola vez. */
  yaAvisado: boolean
}): boolean {
  if (input.reviewStatus) return false
  if (input.conPlanDePagos) return false
  if (input.yaAvisado) return false
  // Entre las 48 y las 72. Pasadas las 72 ya no es un aviso, es una baja: la
  // hace el barrido en la misma corrida y manda su propio mensaje.
  return input.horas >= HORAS_PARA_AVISAR && input.horas < HORAS_DE_GRACIA
}

/** Horas que le quedan, redondeadas hacia abajo y nunca negativas. */
export function horasRestantes(horas: number): number {
  return Math.max(0, Math.floor(HORAS_DE_GRACIA - horas))
}

export function textoDelAviso(input: { estudio: string; horas: number }): { title: string; body: string } {
  const quedan = horasRestantes(input.horas)
  return {
    title: 'Tu matrícula está por vencer',
    body: `Te quedan ${quedan} horas para subir el comprobante de ${input.estudio}. `
      + 'Si no llega, el cupo se libera para otra persona.',
  }
}

export function textoDeLiberacion(input: { estudio: string }): { title: string; body: string } {
  return {
    title: 'Se liberó tu cupo',
    body: `Pasaron ${HORAS_DE_GRACIA} horas sin comprobante y tu matrícula de ${input.estudio} `
      + 'se liberó. Podés volver a matricularte si todavía hay campo.',
  }
}

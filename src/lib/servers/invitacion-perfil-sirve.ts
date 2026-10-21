/**
 * SRV-20 (etapa 4, parte A) · La invitación a llenar el perfil S.I.R.V.E.
 *
 * Pedido de Floriana (2026-10-21): en todo grupo de Sirviendo como Jesús,
 * un botón para el dirigente que manda un correo a los estudiantes pidiendo
 * llenar el formulario del perfil. Es un paso extra del flujo de SCJ; la
 * persona igual puede editar su perfil cuando quiera.
 *
 * Reglas (decididas el mismo día):
 *  · Quién aprieta: coordinación de estudios, o el dirigente / co-dirigente
 *    de ESE grupo. Es la misma regla que cerrar el grupo (`puedeCerrarEsteGrupo`).
 *  · A quién: todos los matriculados ACTIVOS del grupo, no solo los que
 *    completaron. Por eso la audiencia del formulario se abre a «cursando».
 *  · Cuándo: mientras el grupo esté en curso y también cerrado.
 *  · Un correo por persona. Un segundo clic no repite a quien ya recibió:
 *    ofrece reenviar SOLO a quienes aún no llenaron el perfil.
 *
 * Módulo PURO: las reglas. El envío vive en lib/email/sirve-invite-notify.ts.
 */

export const SYSTEM_KEY = 'sirve_invitacion' as const

/** Plan cuyo grupo muestra el botón. */
export const PLAN_SCJ = 'SCJ'

export function esGrupoSCJ(studyTypeId: string | null | undefined): boolean {
  return (studyTypeId ?? '').toUpperCase() === PLAN_SCJ
}

/** Estados de matrícula que reciben el correo: los vigentes (incluye en revisión). */
export const ESTADOS_QUE_RECIBEN = ['enrolled', 'pendiente_de_pago', 'en_revision'] as const

export type Destinatario = {
  memberId: string
  /** Ya le mandamos la invitación por este grupo. */
  yaInvitado: boolean
  /** Ya tocó su perfil S.I.R.V.E. en el sistema. */
  yaLleno: boolean
  /** Se le puede escribir: tiene correo real y no apagó los avisos del sistema.
   *  Quien no, queda fuera de la cuenta: si no, un estudiante sin correo
   *  dejaría el botón para siempre en «enviar» y el reenvío nunca saldría. */
  contactable: boolean
}

/**
 * A quién se le manda en ESTE clic.
 *  · Primer envío: a todos los que no han recibido invitación.
 *  · Reenvío (`reenviar: true`): solo a quienes ya recibieron y aún no llenaron.
 * Nunca a quien ya llenó: no hay nada que pedirle. Nunca a quien no se le
 * puede escribir.
 */
export function destinatariosDelEnvio(lista: readonly Destinatario[], reenviar: boolean): Destinatario[] {
  return lista.filter(d => d.contactable && !d.yaLleno && (reenviar ? d.yaInvitado : !d.yaInvitado))
}

/** Lo que el botón dice antes de apretar. */
export function resumenDeInvitaciones(lista: readonly Destinatario[]): {
  matriculados: number; invitados: number; llenaron: number; pendientes: number
  /** Matriculados a los que no se les puede escribir (sin correo o avisos apagados). */
  sinContacto: number
  /** Qué ofrece el botón ahora. */
  accion: 'enviar' | 'reenviar' | 'nada'
} {
  const invitados = lista.filter(d => d.yaInvitado).length
  const llenaron = lista.filter(d => d.yaLleno).length
  const sinInvitar = destinatariosDelEnvio(lista, false).length
  const pendientes = destinatariosDelEnvio(lista, true).length
  const sinContacto = lista.filter(d => !d.contactable && !d.yaLleno).length
  return {
    matriculados: lista.length, invitados, llenaron, pendientes, sinContacto,
    accion: sinInvitar > 0 ? 'enviar' : pendientes > 0 ? 'reenviar' : 'nada',
  }
}

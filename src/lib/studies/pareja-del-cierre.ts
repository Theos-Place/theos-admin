/**
 * PRE-8 (corrección 2026-10-13) · De dónde sale la pareja al cerrar un
 * grupo prematrimonial.
 *
 * EL BUG. El cierre buscaba las parejas SOLO en la cola de solicitudes
 * (`prematrimonial_requests` con `resulting_group_id` apuntando al grupo).
 * En producción hay UNA sola solicitud, pendiente y sin grupo: los cinco
 * grupos prematrimoniales abiertos se crearon A MANO.
 *
 * Resultado: el cierre no encontraba ninguna pareja, no mostraba el
 * formulario de evaluación, y quien cerraba veía una pantalla que no le
 * pedía nada de lo que tenía que llenar.
 *
 * EL DATO SIEMPRE ESTUVO AHÍ. En un grupo prematrimonial los dos
 * participantes SON la pareja —los mentores son el dirigente y el
 * co-dirigente—. Solo se estaba mirando el lugar equivocado.
 *
 * LA REGLA: si hay solicitud vinculada, manda la solicitud (trae el
 * `request_id` con el que ya se venía guardando, y el historial de la
 * pareja). Si no la hay, la pareja se arma con los participantes.
 *
 * Módulo PURO.
 */

export type ParejaDelCierre = {
  /** Identifica la evaluación. De la solicitud si existe; del grupo si no. */
  clave: string
  /** `true` cuando viene de la cola: lo usa el cierre para saber si guardar
   *  contra `request_id` o contra el grupo. */
  deSolicitud: boolean
  nombres: string
}

export type SolicitudDelGrupo = {
  id: string
  requester_name: string
  spouse_name: string
}

export type ParticipanteDelGrupo = {
  member_id: string
  member_name: string
  /** Una baja no es parte de la pareja que se evalúa. */
  status: string
}

const BAJAS = new Set(['withdrawn', 'dropped', 'cancelada', 'transferred'])

export function participantesActivos(
  ps: readonly ParticipanteDelGrupo[],
): ParticipanteDelGrupo[] {
  return ps.filter(p => !BAJAS.has(p.status))
}

/**
 * Las parejas a evaluar.
 *
 * Con grupo creado a mano hay UNA pareja: los participantes del grupo. Si
 * quedara una sola persona —el otro se retiró— igual se evalúa, porque el
 * acompañamiento ocurrió; lo que no se hace es inventar a quien falta.
 */
export function parejasDelCierre(input: {
  solicitudes: readonly SolicitudDelGrupo[]
  participantes: readonly ParticipanteDelGrupo[]
  groupId: string
}): ParejaDelCierre[] {
  if (input.solicitudes.length > 0) {
    return input.solicitudes.map(s => ({
      clave: s.id,
      deSolicitud: true,
      nombres: [s.requester_name, s.spouse_name].filter(Boolean).join(' y '),
    }))
  }
  const activos = participantesActivos(input.participantes)
  if (activos.length === 0) return []
  return [{
    // La clave es el GRUPO: sin solicitud no hay request_id, y el grupo es
    // lo único estable que identifica a esta evaluación.
    clave: input.groupId,
    deSolicitud: false,
    nombres: activos.map(p => p.member_name).join(' y '),
  }]
}

/** Lo que se le dice a quien cierra, cuando no hay nada que evaluar. */
export const SIN_PAREJA =
  'Este grupo no tiene participantes activos, así que no hay evaluación de pareja que llenar.'

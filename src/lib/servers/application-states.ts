/**
 * SRV-14 · Los cinco estados de una aplicación a un puesto de servicio.
 *
 * EL VOCABULARIO VISIBLE VIVE ACÁ y las columnas siguen en inglés: renombrar
 * los cuatro que ya existían habría obligado a migrar datos y a tocar el RPC
 * `approve_applications`, que es lo único que activa a alguien como servidor.
 * Lo que se agregó de verdad es uno solo, `sent_to_leader`.
 *
 * «ENVIADA AL ENCARGADO» y no «PDF enviado»: dice QUÉ pasó y A QUIÉN, sin
 * amarrarse al medio. Sirve igual si el correo lo mandó el sistema o si
 * alguien bajó el PDF y lo mandó por WhatsApp — que es como va a pasar la
 * mitad de las veces.
 *
 * QUÉ HACE CADA UNO, porque dos de ellos NO son solo una etiqueta:
 *   · `approved` ACTIVA a la persona como servidora del puesto (RPC
 *     `approve_applications` + sincronización de roles). Es irreversible desde
 *     esta pantalla.
 *   · `reviewing` dispara el aviso a RH y al staff con el motivo.
 * Los otros tres solo cambian el estado.
 *
 * Módulo PURO.
 */

export const APPLICATION_STATES = [
  'pending', 'sent_to_leader', 'reviewing', 'approved', 'rejected',
] as const
export type ApplicationState = typeof APPLICATION_STATES[number]

export const APPLICATION_STATE_LABEL: Record<ApplicationState, string> = {
  pending: 'Recibida',
  sent_to_leader: 'Enviada al encargado',
  reviewing: 'En revisión',
  approved: 'Aceptada',
  rejected: 'Rechazada',
}

/**
 * Qué significa cada uno para quien lo lee en la lista. Va junto a la etiqueta
 * porque «en revisión» y «recibida» suenan parecido y no lo son: la primera es
 * una persona que ya fue aceptada y está esperando una decisión de staff.
 */
export const APPLICATION_STATE_HELP: Record<ApplicationState, string> = {
  pending: 'Llegó y nadie la ha tocado.',
  sent_to_leader: 'El encargado del puesto ya tiene los datos de la persona.',
  reviewing: 'Aceptada, pero para otro puesto o con algo que staff tiene que resolver.',
  approved: 'Aceptada: la persona ya quedó asignada al puesto.',
  rejected: 'No sigue en el proceso.',
}

/** Clases del badge, con la misma paleta del resto del sistema. */
export const APPLICATION_STATE_BADGE: Record<ApplicationState, string> = {
  pending: 'bg-navy-light/10 text-navy-light/80',
  sent_to_leader: 'bg-[rgba(59,117,121,0.14)] text-[#2F5C5F]',
  reviewing: 'bg-[rgba(233,185,73,0.15)] text-[#A8821F]',
  approved: 'bg-success/12 text-success',
  rejected: 'bg-coral/10 text-coral-deep',
}

export function isApplicationState(v: string): v is ApplicationState {
  return (APPLICATION_STATES as readonly string[]).includes(v)
}

/**
 * ¿Se puede mover de `desde` a `hacia`?
 *
 * `approved` NO SE DESHACE desde acá, y esa es la única regla dura: aceptar
 * dio de alta a la persona como servidora del puesto y le sincronizó los roles
 * que ese puesto otorga. Volver la aplicación a «recibida» dejaría la pantalla
 * diciendo una cosa y los datos otra — a la persona sirviendo y con permisos.
 * Para deshacerlo hay que quitarla del puesto, que es otra pantalla.
 */
export function motivoQueImpideCambiar(desde: string, hacia: string): string | null {
  if (!isApplicationState(hacia)) return 'Ese estado no existe.'
  if (desde === hacia) return 'La aplicación ya está en ese estado.'
  if (desde === 'approved') {
    return 'Esta aplicación ya fue aceptada y la persona quedó asignada al puesto. '
      + 'Para revertirlo hay que quitarla del puesto desde el comité.'
  }
  return null
}

/** Los estados a los que se puede mover una aplicación, para el selector. */
export function estadosDestino(desde: string): ApplicationState[] {
  return APPLICATION_STATES.filter(s => motivoQueImpideCambiar(desde, s) === null)
}

/** `reviewing` es el único que acepta —y pide— un motivo. En los demás, una
 *  nota suelta no tiene dónde leerse. */
export function admiteMotivo(estado: string): boolean {
  return estado === 'reviewing'
}

/**
 * A quién se le avisa al pasar a cada estado. Vacío = a nadie, y eso también
 * es una decisión: «rechazada» NO manda correos (dictado), porque el aviso de
 * un rechazo automático es peor que el silencio — esa conversación la tiene
 * una persona.
 */
export type AvisoDeEstado = 'encargado_del_puesto' | 'rh_y_staff'

export function avisosDe(estado: string): AvisoDeEstado[] {
  if (estado === 'sent_to_leader') return ['encargado_del_puesto']
  if (estado === 'reviewing') return ['rh_y_staff']
  if (estado === 'approved') return ['rh_y_staff']
  return []
}

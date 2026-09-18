/**
 * ¿Se puede marcar a esta persona como SERVIDOR en este evento?
 *
 * La regla es del check-in (validación 2): servidor solo quien es voluntario
 * activo de algún comité organizador del evento. Si el evento no tiene comité
 * organizador, se permite — es el caso de los eventos históricos, y negar ahí
 * sería impedir algo legítimo por falta de un dato.
 *
 * EL HUECO QUE CIERRA (reportado 2026-09-18). Antes esto eran tres ternarios
 * dentro de la pantalla y el estado "todavía no sé" —la consulta viajando— se
 * trataba igual que "no puede": no salía el botón Y TAMPOCO ningún aviso. Quien
 * operaba veía una tarjeta sin la opción y sin explicación, y si la consulta
 * fallaba se quedaba así para siempre. Ahora "cargando" es un estado propio y
 * se dice en pantalla.
 *
 * Vive acá y no en la pantalla porque lo usan DOS lugares: la tarjeta de
 * confirmación y el modal de familia, que hasta hoy ni siquiera ofrecía la
 * opción.
 */
export type InfoDeServidor = { hasCommittees: boolean; isServer: boolean }

export type PuertaDeServidor = {
  estado: 'cargando' | 'permitido' | 'bloqueado'
  /** Qué decirle a quien opera. null = no hay nada que explicar. */
  aviso: string | null
}

export const VERIFICANDO = 'Verificando si puede marcarse como servidor…'
export const NO_ES_SERVIDOR =
  'Solo servidores activos del comité organizador pueden marcarse como servidor.'
export const SIN_COMITE = 'Sin comité organizador asignado.'

export function puertaDeServidor(info: InfoDeServidor | null | undefined): PuertaDeServidor {
  if (!info) return { estado: 'cargando', aviso: VERIFICANDO }
  // Sin comités no hay contra qué validar: permisivo, pero se dice por qué.
  if (!info.hasCommittees) return { estado: 'permitido', aviso: SIN_COMITE }
  if (info.isServer) return { estado: 'permitido', aviso: null }
  return { estado: 'bloqueado', aviso: NO_ES_SERVIDOR }
}

/** Atajo para la UI: ¿se dibuja el botón de "Servidor"? */
export function ofreceServidor(p: PuertaDeServidor): boolean {
  return p.estado === 'permitido'
}

/**
 * DIR-8/DIR-9 · «Dirigiendo un estudio» se DERIVA, no se guarda.
 *
 * EL PROBLEMA QUE RESUELVE (medido el 2026-10-13): 109 dirigentes tienen un
 * grupo en curso o en matrícula y 106 de ellos tienen `disponibilidad =
 * 'disponible'` en su ficha. O sea que la ficha dice que están libres
 * cuando están ocupados.
 *
 * OJO CON DÓNDE ESTÁ EL BUG, que no es obvio. El reporte VIEJO (DIR-7) no
 * lo tiene: nunca leyó este campo, deriva «dando ahora» de los grupos y hoy
 * da 88 disponibles sin grupo, que es correcto. El campo roto es el de
 * DIR-8, que alimenta la FICHA y los filtros. El reporte nuevo sí lo lee,
 * así que heredaría el error — por eso se deriva acá también, con la misma
 * definición, en vez de confiar en la columna.
 *
 * DIR-8 ya decía que esta razón es automática. Lo que faltaba era que
 * alguien la mantuviera: la conversión no pudo ponerla (el dato no existía)
 * y nada la actualiza cuando a alguien le asignan o le cierran un grupo.
 *
 * POR QUÉ DERIVADA Y NO GUARDADA. Un valor guardado hay que mantenerlo
 * sincronizado con los grupos, y en este repo eso falló ya tres veces este
 * mes por la misma causa: el mismo hecho escrito en dos lugares. Derivarla
 * la vuelve imposible de desincronizar.
 *
 * LO QUE COORDINACIÓN ELIGIÓ GANA. Si alguien puso «pausa» o «pasantía» a
 * mano, eso manda aunque la persona tenga un grupo: es una decisión, no un
 * descuido. La derivación solo rellena el hueco.
 *
 * Módulo PURO.
 */
import type { RazonNoDisponible } from './estado-del-dirigente'

/**
 * El prematrimonial NO ocupa al dirigente.
 *
 * Decisión de DIR-8: dar prematrimonial no cambia la disponibilidad. Son
 * parejas de mentores que acompañan a una pareja, no un grupo de estudio
 * que llene la agenda — y hay quien da varios.
 */
export const PLANES_QUE_NO_OCUPAN = ['PREMAT'] as const

export function ocupaAlDirigente(planCode: string | null | undefined): boolean {
  return !!planCode && !(PLANES_QUE_NO_OCUPAN as readonly string[]).includes(planCode)
}

export type EstadoGuardado = {
  estado_base: string | null
  disponibilidad: string | null
  razon_no_disponible: string | null
}

/**
 * La disponibilidad EFECTIVA, que es la que se muestra y se cuenta.
 *
 * Devuelve lo guardado tal cual, salvo cuando la persona figura disponible y
 * tiene un grupo que la ocupa: ahí pasa a «no disponible · dirigiendo».
 */
export function disponibilidadEfectiva(input: {
  estado: EstadoGuardado
  /** ¿Tiene al menos un grupo en curso o en matrícula que la ocupe? */
  dirigiendo: boolean
}): { disponibilidad: string | null; razonNoDisponible: RazonNoDisponible | null; derivada: boolean } {
  const { estado, dirigiendo } = input
  const guardada = (estado.razon_no_disponible ?? null) as RazonNoDisponible | null

  // Un inactivo no tiene disponibilidad, tenga grupo o no. Si además está
  // dirigiendo, eso es una inconsistencia que el reporte muestra aparte
  // (EST-1: «nunca un dirigente inactivo con grupo activo»).
  if (estado.estado_base !== 'activo') {
    return { disponibilidad: null, razonNoDisponible: null, derivada: false }
  }
  // Lo que coordinación eligió manda.
  if (estado.disponibilidad === 'no_disponible' && guardada) {
    return { disponibilidad: 'no_disponible', razonNoDisponible: guardada, derivada: false }
  }
  if (dirigiendo) {
    return { disponibilidad: 'no_disponible', razonNoDisponible: 'dirigiendo', derivada: true }
  }
  return {
    disponibilidad: estado.disponibilidad,
    razonNoDisponible: guardada,
    derivada: false,
  }
}

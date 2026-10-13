/**
 * PRE-9 · Los cierres de prematrimonial, para poder leerlos.
 *
 * QUÉ FALTABA: los mentores llenan la evaluación al cerrar el grupo —
 * compromiso de la pareja, fortalezas, temas por trabajar, puntos ciegos,
 * plan de acción— y después nadie podía verla. El dato existía desde PRE-8
 * y solo se alcanzaba sabiendo de antemano el id de la pareja.
 *
 * LO QUE NO VA EN LA LISTA, y es deliberado: el punto ciego, las
 * observaciones y la bendición NO viajan al listado. Son contenido pastoral
 * —«desacuerdo grave o tema no resuelto que pudiera generar fricción en el
 * matrimonio»— y una lista se mira de reojo, con alguien al lado y la
 * pantalla compartida. Se abren de a una, a propósito.
 *
 * Lo que sí va en la lista es lo que se necesita para DECIDIR a cuál entrar:
 * quiénes son, cuándo cerraron, y si quedaron en seguimiento.
 *
 * Módulo PURO.
 */
import {
  COMMITMENT_OPTIONS, ACTION_PLAN_OPTIONS, needsFollowUp,
} from './premat-evaluation'

export type CierreEnLista = {
  id: string
  /** Los dos nombres, ya resueltos. */
  pareja: string
  grupo: string | null
  /** Quién llenó la evaluación (el o la mentora). */
  mentores: string | null
  fecha: string
  commitment: string
  action_plan: string
  /** Cuántos temas marcaron por trabajar. El detalle dice cuáles. */
  temas: number
  /** NO se expone de qué se trata: solo que hay algo anotado. */
  tiene_punto_ciego: boolean
}

export const ETIQUETA_COMPROMISO: Record<string, string> =
  Object.fromEntries(COMMITMENT_OPTIONS.map(o => [o.value, o.label]))

export const ETIQUETA_PLAN: Record<string, string> =
  Object.fromEntries(ACTION_PLAN_OPTIONS.map(o => [o.value, o.label]))

/** El texto del catálogo, o el valor crudo si alguien agregó una opción
 *  nueva sin pasar por acá: mejor un código a la vista que una celda vacía. */
export const etiquetaDeCompromiso = (v: string): string => ETIQUETA_COMPROMISO[v] ?? v
export const etiquetaDePlan = (v: string): string => ETIQUETA_PLAN[v] ?? v

/**
 * Qué tan urgente es mirar este cierre.
 *
 * `posponer` primero porque hay una fecha de boda de por medio y el tiempo
 * corre; después `consejeria`, que pide acompañamiento pero no bloquea; y
 * de últimos los que quedaron listos, que son los que no hay que atender.
 */
export function prioridad(c: Pick<CierreEnLista, 'action_plan'>): number {
  if (c.action_plan === 'posponer') return 0
  if (needsFollowUp(c.action_plan)) return 1
  return 2
}

/** Los que piden acción arriba y, dentro de cada grupo, los más recientes. */
export function ordenarCierres<T extends Pick<CierreEnLista, 'action_plan' | 'fecha'>>(
  cierres: readonly T[],
): T[] {
  return [...cierres].sort((a, b) =>
    prioridad(a) - prioridad(b) || b.fecha.localeCompare(a.fecha))
}

export type ResumenDeCierres = {
  total: number
  listos: number
  enSeguimiento: number
  conPuntoCiego: number
}

export function resumenDeCierres(cierres: readonly CierreEnLista[]): ResumenDeCierres {
  return {
    total: cierres.length,
    listos: cierres.filter(c => !needsFollowUp(c.action_plan)).length,
    enSeguimiento: cierres.filter(c => needsFollowUp(c.action_plan)).length,
    conPuntoCiego: cierres.filter(c => c.tiene_punto_ciego).length,
  }
}

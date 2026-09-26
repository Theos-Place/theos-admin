/**
 * SRV-15b · Qué solicitudes se ven al abrir la pantalla.
 *
 * ABRE EN «LISTAS PARA PUBLICAR» y no en todas. La pantalla existe para una
 * tarea concreta —repasar lo que pidieron los comités y publicarlo los
 * primeros del mes—, y en esa tarea las publicadas, las bajadas y las
 * denegadas son ruido que crece para siempre: cada mes deja su tanda. Al año
 * de uso, abrir en «todas» sería abrir en el historial.
 *
 * EL HISTORIAL NO SE ESCONDE, se filtra: los otros estados están a un clic y
 * el chip dice cuántas hay. Un filtro por defecto que no se ve es una lista
 * incompleta que parece completa, y eso ya hizo que alguien diera por perdida
 * una solicitud que estaba ahí.
 *
 * Módulo PURO: lo usan la pantalla, la ruta y el Excel, para que el archivo
 * que se baja tenga lo mismo que se está viendo.
 */

import { VACANCY_STATES, type VacancyState } from './vacancy-states'

export const FILTRO_TODAS = 'todas'
export type FiltroDeSolicitudes = VacancyState | typeof FILTRO_TODAS

export const FILTRO_POR_DEFECTO: FiltroDeSolicitudes = 'lista_para_publicar'

/** El orden es el del ciclo, y «Todas» al final: es la salida, no la entrada. */
export const FILTROS: readonly FiltroDeSolicitudes[] = [...VACANCY_STATES, FILTRO_TODAS]

export const FILTRO_LABEL: Record<FiltroDeSolicitudes, string> = {
  lista_para_publicar: 'Listas para publicar',
  publicada: 'Publicadas',
  despublicada: 'Despublicadas',
  denegado: 'Denegadas',
  [FILTRO_TODAS]: 'Todas',
}

export function esFiltroDeSolicitudes(v: string): v is FiltroDeSolicitudes {
  return (FILTROS as readonly string[]).includes(v)
}

/** Lo que venga por la URL: si no se entiende, el de por defecto y no un error.
 *  Un filtro mal escrito no es motivo para no mostrar la pantalla. */
export function filtroDesde(v: string | null | undefined): FiltroDeSolicitudes {
  return v && esFiltroDeSolicitudes(v) ? v : FILTRO_POR_DEFECTO
}

export function solicitudesConEstado<T extends { estado: string }>(
  items: readonly T[],
  filtro: FiltroDeSolicitudes,
): T[] {
  return filtro === FILTRO_TODAS ? [...items] : items.filter(i => i.estado === filtro)
}

/**
 * Cuántas hay en cada filtro, para el número del chip.
 *
 * Las de estado DESCONOCIDO —una fila que quedó con un nombre viejo por un
 * script o un rollback a medias— cuentan solo en «Todas». Es a propósito: así
 * el número de «Todas» no cuadra con la suma de los otros, y esa diferencia
 * es la única señal de que hay una fila que ningún filtro muestra.
 */
export function conteoPorFiltro<T extends { estado: string }>(
  items: readonly T[],
): Record<FiltroDeSolicitudes, number> {
  const c = Object.fromEntries(FILTROS.map(f => [f, 0])) as Record<FiltroDeSolicitudes, number>
  for (const i of items) {
    if (esFiltroDeSolicitudes(i.estado) && i.estado !== FILTRO_TODAS) c[i.estado] += 1
    c[FILTRO_TODAS] += 1
  }
  return c
}

/** El texto de la lista vacía, que depende del filtro: «no hay solicitudes» es
 *  falso cuando lo que pasa es que no hay denegadas. */
export function vacioSegunFiltro(filtro: FiltroDeSolicitudes): { titulo: string; detalle: string } {
  if (filtro === FILTRO_TODAS) {
    return {
      titulo: 'Todavía no hay solicitudes',
      detalle: 'Los comités piden sus cupos del 25 al 30 de cada mes.',
    }
  }
  return {
    titulo: `No hay solicitudes ${FILTRO_LABEL[filtro].toLowerCase()}`,
    detalle: 'Probá con otro filtro o con «Todas».',
  }
}


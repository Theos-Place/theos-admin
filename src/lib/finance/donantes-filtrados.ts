/**
 * DON-5 · Las tarjetas de Donaciones siguen a los filtros (Floriana,
 * 2026-10-28): «Donantes identificados» cuenta a quienes donaron en lo
 * filtrado, y «Total donado este mes» pasa a decir el rango elegido.
 *
 * Mismo molde que PAG-7 (`totales-filtrados.ts`): acá vive la traducción de
 * los filtros de la lista a los argumentos del RPC `donation_stats_filtrados`
 * y el rótulo de la tarjeta, para que los tests los fijen.
 *
 * Módulo PURO.
 */
import { tokensDeBusqueda } from './totales-filtrados'

export type FiltrosDeDonaciones = {
  search?: string
  status?: 'all' | 'identified' | 'unidentified'
  from?: string
  to?: string
}

export type ArgumentosDeDonantes = {
  p_from: string | null
  p_to: string | null
  p_status: 'identified' | 'unidentified' | null
  p_search_tokens: string[] | null
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const fecha = (s: string | undefined): string | null => (s && YMD.test(s) ? s : null)

export function argumentosDeDonantes(f: FiltrosDeDonaciones): ArgumentosDeDonantes {
  const tokens = tokensDeBusqueda(f.search)
  return {
    p_from: fecha(f.from),
    p_to: fecha(f.to),
    p_status: f.status === 'identified' || f.status === 'unidentified' ? f.status : null,
    p_search_tokens: tokens.length ? tokens : null,
  }
}

/** dd/mm/aaaa a partir de YYYY-MM-DD, sin pasar por Date (no hay zona que corra el día). */
const ddmmaaaa = (ymd: string): string => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`

/**
 * El rótulo de la tarjeta del total. Sin rango es «este mes», que es lo que
 * suma `donation_stats()`. Con rango, dice el rango: «del … al …», «desde …»
 * o «hasta …». Si hay otros filtros (búsqueda, estado) pero no rango, el total
 * es el de lo filtrado y el rótulo lo dice sin inventar un período.
 */
export function etiquetaDeTotalDonado(from: string | undefined, to: string | undefined, hayOtrosFiltros = false): string {
  const a = fecha(from), b = fecha(to)
  if (a && b) return `Total donado del ${ddmmaaaa(a)} al ${ddmmaaaa(b)}`
  if (a) return `Total donado desde el ${ddmmaaaa(a)}`
  if (b) return `Total donado hasta el ${ddmmaaaa(b)}`
  return hayOtrosFiltros ? 'Total donado (lo filtrado)' : 'Total donado este mes'
}

export const INFO_DONANTES_IDENTIFICADOS =
  'Personas distintas que donaron y a las que se les pudo identificar (la donación está vinculada a su ficha), '
  + 'cada una una sola vez aunque haya donado muchas veces. Sin filtros cuenta toda la historia; '
  + 'con un rango de fecha u otro filtro, solo las donaciones que coinciden.'

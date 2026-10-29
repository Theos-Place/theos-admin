/**
 * PAG-7 · Los totales de la pantalla de pagos («Total cobrado», «Pendientes»)
 * siguen a los filtros de la lista.
 *
 * Antes salían de `payment_stats()`, que suma la tabla entera: con el rango
 * de fecha puesto para conciliar un mes, la lista mostraba ese mes y las
 * tarjetas seguían diciendo el total histórico (Floriana, 2026-10-28).
 *
 * Acá vive la traducción de los filtros de la lista a los argumentos del RPC
 * `payment_stats_filtrados`, para que el test la fije. La búsqueda se
 * tokeniza IGUAL que `applyMemberSearch` (sin tildes, minúsculas, sin los
 * caracteres que PostgREST interpreta): un token distinto haría que la lista
 * y los totales no hablaran de las mismas filas.
 *
 * Módulo PURO.
 */
import { rangoDePago } from './rango-de-pagos'

export type FiltrosDeTotales = {
  search?: string
  entity_type?: 'event' | 'study_group'
  method?: string
  status?: string
  currency?: string
  inPaymentPlan?: boolean
  paidFrom?: string
  paidTo?: string
}

export type ArgumentosDeTotales = {
  p_search_tokens: string[] | null
  p_entity_type: string | null
  p_method: string | null
  p_status: string | null
  p_currency: string | null
  p_in_plan: boolean
  p_paid_from: string | null
  p_paid_to: string | null
}

/** Misma normalización que applyMemberSearch (queries/members.ts). */
export function tokensDeBusqueda(search: string | undefined): string[] {
  return (search ?? '').trim().split(/\s+/)
    .map(t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[%,()]/g, ''))
    .filter(Boolean)
}

export function argumentosDeTotales(f: FiltrosDeTotales): ArgumentosDeTotales {
  const tokens = tokensDeBusqueda(f.search)
  const { desdeIso, hastaIso } = rangoDePago(f.paidFrom, f.paidTo)
  return {
    p_search_tokens: tokens.length ? tokens : null,
    p_entity_type: f.entity_type ?? null,
    p_method: f.method || null,
    p_status: f.status || null,
    p_currency: f.currency || null,
    p_in_plan: f.inPaymentPlan === true,
    p_paid_from: desdeIso,
    p_paid_to: hastaIso,
  }
}

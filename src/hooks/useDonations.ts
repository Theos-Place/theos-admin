import { useCallback } from 'react'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { useCargaRemota, json } from '@/hooks/useCargaRemota'
import type { DbDonation } from '@/lib/supabase/queries/finance'
import { toDomainDonation } from '@/lib/finance/adapter'
import type { Donation } from '@/types/finance'
import type { MoneyTotals } from '@/lib/money'

export type DonationSearchParams = {
  search?: string
  status?: 'all' | 'identified' | 'unidentified'
  from?: string
  to?: string
}

export type DonationStats = {
  unique_donors: number
  /** FIN-1: miembros con is_donor=true. La ventana la define
   *  `lib/finance/ventana-de-donante` — no repetir el número acá. */
  active_donors: number
  /** INT-3: por moneda ({"CRC": 1250000}). null = sin permiso de ver montos. */
  total_this_month: MoneyTotals | null
  unidentified_count: number
  unidentified_total: MoneyTotals | null
}

const PAGE_SIZE = 50

/** FIN-1: ¿hay algún filtro activo? (con filtros se pide la suma server-side). */
export function hasActiveDonationFilters(params: DonationSearchParams): boolean {
  return !!(params.search?.trim() || (params.status && params.status !== 'all') || params.from || params.to)
}

function buildQuery(params: DonationSearchParams, page: number): string {
  const u = new URLSearchParams()
  if (hasActiveDonationFilters(params)) u.set('with_sum', '1')
  if (params.search && params.search.trim()) u.set('search', params.search.trim())
  if (params.status && params.status !== 'all') u.set('status', params.status)
  if (params.from) u.set('from', params.from)
  if (params.to) u.set('to', params.to)
  u.set('page', String(page))
  u.set('pageSize', String(PAGE_SIZE))
  return u.toString()
}

/**
 * Donaciones paginadas server-side con acumulación + stats globales (SQL).
 *
 * LINT-1 (2026-09-22): la paginación la lleva `usePaginatedList`, que deriva
 * "cargando" del sello en vez de encenderlo dentro del efecto. Acá quedan las
 * dos cosas propias de donaciones: las STATS globales —que no dependen del
 * filtro y por eso son su propia carga— y `filtered_sum`, que sí depende del
 * filtro y por eso viaja como `extra` de la lista. Si se guardara aparte, al
 * cambiar de filtro se vería la suma vieja junto a la lista nueva.
 */
export function useDonations(params: DonationSearchParams) {
  const lista = usePaginatedList<DbDonation, Donation, MoneyTotals | null>(
    page => `/api/finance/donations?${buildQuery(params, page)}`,
    {
      pageSize: PAGE_SIZE,
      itemsKey: 'donations',
      mapItem: toDomainDonation,
      leerExtra: d => (d.filtered_sum as MoneyTotals | null) ?? null,
    },
  )

  // Las stats NO dependen del filtro: son del padrón entero. Por eso van por su
  // cuenta y con clave fija — recargarlas en cada tecleo de la búsqueda sería
  // una consulta agregada por letra.
  const { datos: stats, recargar: recargarStats } = useCargaRemota<DonationStats>(
    'donaciones:stats',
    () => json<DonationStats>('/api/finance/donations?stats=1', 'Error cargando las estadísticas.'),
  )

  // Depende de las FUNCIONES, no del objeto `lista`: ese es nuevo en cada
  // render, y un `refetch` inestable en la lista de dependencias de un efecto
  // del consumidor es un bucle.
  const recargarLista = lista.reload
  const refetch = useCallback(() => {
    recargarLista()
    void recargarStats()
  }, [recargarLista, recargarStats])

  return {
    donations: lista.items,
    total: lista.total,
    stats,
    filteredSum: lista.extra,
    loading: lista.loading,
    error: lista.error,
    hasMore: lista.hasMore,
    loadMore: lista.loadMore,
    refetch,
    pageSize: PAGE_SIZE,
  }
}

import { useState, useEffect, useCallback } from 'react'
import type { DbDonation } from '@/lib/supabase/queries/finance'
import { toDomainDonation } from '@/lib/finance/adapter'
import type { Donation } from '@/types/finance'

export type DonationSearchParams = {
  search?: string
  status?: 'all' | 'identified' | 'unidentified'
  from?: string
  to?: string
}

export type DonationStats = {
  unique_donors: number
  total_this_month: number | null
  unidentified_count: number
  unidentified_total: number | null
}

const PAGE_SIZE = 50

function buildQuery(params: DonationSearchParams, page: number): string {
  const u = new URLSearchParams()
  if (params.search && params.search.trim()) u.set('search', params.search.trim())
  if (params.status && params.status !== 'all') u.set('status', params.status)
  if (params.from) u.set('from', params.from)
  if (params.to) u.set('to', params.to)
  u.set('page', String(page))
  u.set('pageSize', String(PAGE_SIZE))
  return u.toString()
}

/** Donaciones paginadas server-side con acumulación + stats globales (SQL). */
export function useDonations(params: DonationSearchParams) {
  const [donations, setDonations] = useState<Donation[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [stats, setStats]     = useState<DonationStats | null>(null)

  const key = buildQuery(params, 1)

  // Primera página (corre cuando cambian los filtros).
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    fetch(`/api/finance/donations?${key}`)
      .then(r => { if (!r.ok) throw new Error('Error cargando donaciones'); return r.json() })
      .then((d: { donations: DbDonation[]; total: number }) => {
        if (cancelled) return
        setDonations((d.donations ?? []).map(toDomainDonation))
        setTotal(d.total ?? 0)
        setPage(1)
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [key])

  // Stats globales — se recargan con refreshStats() tras vincular una donación.
  const loadStats = useCallback(() => {
    fetch('/api/finance/donations?stats=1')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setStats(d) })
      .catch(() => {})
  }, [])
  useEffect(() => { loadStats() }, [loadStats])

  const loadMore = useCallback(async () => {
    const next = page + 1
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/donations?${buildQuery(params, next)}`)
      if (!res.ok) throw new Error('Error cargando más donaciones')
      const d = (await res.json()) as { donations: DbDonation[]; total: number }
      setDonations(prev => [...prev, ...(d.donations ?? []).map(toDomainDonation)])
      setTotal(d.total ?? 0)
      setPage(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [page, params])

  const refetch = useCallback(() => {
    setLoading(true); setError(null)
    fetch(`/api/finance/donations?${buildQuery(params, 1)}`)
      .then(r => { if (!r.ok) throw new Error('Error cargando donaciones'); return r.json() })
      .then((d: { donations: DbDonation[]; total: number }) => {
        setDonations((d.donations ?? []).map(toDomainDonation))
        setTotal(d.total ?? 0)
        setPage(1)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Error desconocido'))
      .finally(() => setLoading(false))
    loadStats()
  }, [params, loadStats])

  return {
    donations, total, stats, loading, error,
    hasMore: donations.length < total,
    loadMore, refetch, pageSize: PAGE_SIZE,
  }
}

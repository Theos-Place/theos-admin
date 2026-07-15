import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  DbPayment, DbDonation, DbRefund, DbImportBatch,
} from '@/lib/supabase/queries/finance'
import {
  toDomainPayment, toDomainDonation, toDomainRefund, toDomainImportBatch,
} from '@/lib/finance/adapter'
import type { Payment, Donation, Refund, ImportBatch } from '@/types/finance'
import type { Scholarship } from '@/lib/supabase/queries/scholarships'

export type FinanceSlice = 'payments' | 'donations' | 'refunds' | 'scholarships' | 'importBatches'

const ALL_SLICES: FinanceSlice[] = ['payments', 'donations', 'refunds', 'scholarships', 'importBatches']

const ENDPOINT: Record<FinanceSlice, string> = {
  payments: '/api/finance/payments',
  // /api/finance/donations devuelve { donations, total } (paginado); con
  // ?all=1 trae todas para los agregados/export del dashboard y reportes.
  donations: '/api/finance/donations?all=1',
  refunds: '/api/finance/refunds',
  scholarships: '/api/finance/scholarships',
  importBatches: '/api/finance/import-batches',
}

// Caché a nivel de módulo: navegar entre pantallas de finanzas ya no
// re-descarga los mismos datos (antes cada montaje disparaba 5 fetches
// completos, incluidas TODAS las donaciones). refetch() la salta.
const TTL_MS = 30_000
const cache = new Map<FinanceSlice, { data: unknown[]; ts: number }>()

/** Datos de finanzas por slice. `useFinance('refunds')` descarga SOLO
 *  devoluciones; sin argumentos trae todo (compatibilidad). Los slices no
 *  pedidos quedan como []. */
export function useFinance(...slices: FinanceSlice[]) {
  const wantedKey = (slices.length ? slices : ALL_SLICES).join(',')

  const [dbPayments, setDbPayments]   = useState<DbPayment[]>([])
  const [dbDonations, setDbDonations] = useState<DbDonation[]>([])
  const [dbRefunds, setDbRefunds]     = useState<DbRefund[]>([])
  const [dbScholar, setDbScholar]     = useState<Scholarship[]>([])
  const [dbBatches, setDbBatches]     = useState<DbImportBatch[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const fetchAll = useCallback(async (force = false) => {
    const wanted = wantedKey.split(',') as FinanceSlice[]
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(wanted.map(async (slice): Promise<[FinanceSlice, unknown[]]> => {
        const hit = cache.get(slice)
        if (!force && hit && Date.now() - hit.ts < TTL_MS) return [slice, hit.data]
        const res = await fetch(ENDPOINT[slice])
        if (!res.ok) throw new Error('Error cargando finanzas')
        const json = await res.json()
        const rows: unknown[] = Array.isArray(json) ? json : (json.donations ?? [])
        cache.set(slice, { data: rows, ts: Date.now() })
        return [slice, rows]
      }))
      for (const [slice, rows] of results) {
        if (slice === 'payments') setDbPayments(rows as DbPayment[])
        else if (slice === 'donations') setDbDonations(rows as DbDonation[])
        else if (slice === 'refunds') setDbRefunds(rows as DbRefund[])
        else if (slice === 'scholarships') setDbScholar(rows as Scholarship[])
        else setDbBatches(rows as DbImportBatch[])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [wantedKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  // refetch fuerza red (salta la caché): se usa tras mutaciones.
  const refetch = useCallback(() => fetchAll(true), [fetchAll])

  const payments: Payment[]         = useMemo(() => dbPayments.map(toDomainPayment), [dbPayments])
  const donations: Donation[]       = useMemo(() => dbDonations.map(toDomainDonation), [dbDonations])
  const refunds: Refund[]           = useMemo(() => dbRefunds.map(toDomainRefund), [dbRefunds])
  const scholarships: Scholarship[] = dbScholar
  const importBatches: ImportBatch[] = useMemo(() => dbBatches.map(toDomainImportBatch), [dbBatches])

  return { payments, donations, refunds, scholarships, importBatches, loading, error, refetch }
}

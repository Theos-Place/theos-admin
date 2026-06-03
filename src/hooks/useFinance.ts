import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  DbPayment, DbDonation, DbRefund, DbScholarship, DbImportBatch,
} from '@/lib/supabase/queries/finance'
import {
  toDomainPayment, toDomainDonation, toDomainRefund, toDomainScholarship, toDomainImportBatch,
} from '@/lib/finance/adapter'
import type { Payment, Donation, Refund, Scholarship, ImportBatch } from '@/types/finance'

export function useFinance() {
  const [dbPayments, setDbPayments]   = useState<DbPayment[]>([])
  const [dbDonations, setDbDonations] = useState<DbDonation[]>([])
  const [dbRefunds, setDbRefunds]     = useState<DbRefund[]>([])
  const [dbScholar, setDbScholar]     = useState<DbScholarship[]>([])
  const [dbBatches, setDbBatches]     = useState<DbImportBatch[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, d, r, s, b] = await Promise.all([
        fetch('/api/finance/payments'),
        fetch('/api/finance/donations'),
        fetch('/api/finance/refunds'),
        fetch('/api/finance/scholarships'),
        fetch('/api/finance/import-batches'),
      ])
      if (![p, d, r, s, b].every((x) => x.ok)) throw new Error('Error cargando finanzas')
      setDbPayments(await p.json())
      setDbDonations(await d.json())
      setDbRefunds(await r.json())
      setDbScholar(await s.json())
      setDbBatches(await b.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const payments: Payment[]         = useMemo(() => dbPayments.map(toDomainPayment), [dbPayments])
  const donations: Donation[]       = useMemo(() => dbDonations.map(toDomainDonation), [dbDonations])
  const refunds: Refund[]           = useMemo(() => dbRefunds.map(toDomainRefund), [dbRefunds])
  const scholarships: Scholarship[] = useMemo(() => dbScholar.map(toDomainScholarship), [dbScholar])
  const importBatches: ImportBatch[] = useMemo(() => dbBatches.map(toDomainImportBatch), [dbBatches])

  return { payments, donations, refunds, scholarships, importBatches, loading, error, refetch: fetchAll }
}

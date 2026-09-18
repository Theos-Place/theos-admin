import { useCallback, useMemo, useRef } from 'react'
import { useCargaRemota } from './useCargaRemota'
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
/** Lo que trae una carga. La constante vacía evita que un `?? {...}` cambie de
 *  identidad en cada render y deje en bucle a quien lo consuma. */
type Datos = {
  payments: DbPayment[]; donations: DbDonation[]; refunds: DbRefund[]
  scholarships: Scholarship[]; batches: DbImportBatch[]
}
const NINGUNO: Datos = { payments: [], donations: [], refunds: [], scholarships: [], batches: [] }

export function useFinance(...slices: FinanceSlice[]) {
  const wantedKey = (slices.length ? slices : ALL_SLICES).join(',')

  /**
   * LINT-1 · Sin `setLoading` dentro del efecto: useCargaRemota lo deriva del
   * sello de la petición. `forzar` va por ref y no en la clave porque no cambia
   * QUÉ se pide, solo si se ignora el caché.
   */
  const forzarRef = useRef(false)
  const { datos, cargando, error, recargar } = useCargaRemota<Datos>(wantedKey, async () => {
    const forzar = forzarRef.current
    forzarRef.current = false
    const wanted = wantedKey.split(',') as FinanceSlice[]
    const results = await Promise.all(wanted.map(async (slice): Promise<[FinanceSlice, unknown[]]> => {
      const hit = cache.get(slice)
      if (!forzar && hit && Date.now() - hit.ts < TTL_MS) return [slice, hit.data]
      const res = await fetch(ENDPOINT[slice])
      if (!res.ok) throw new Error('Error cargando finanzas')
      const json = await res.json()
      // Algunos endpoints devuelven el array pelado y otros lo envuelven con
      // metadata (donations con su total; refunds con can_resolve desde
      // FIN-6). La clave del sobre coincide con el nombre del slice.
      const rows: unknown[] = Array.isArray(json) ? json : (json[slice] ?? json.donations ?? [])
      cache.set(slice, { data: rows, ts: Date.now() })
      return [slice, rows]
    }))
    const out: Datos = { payments: [], donations: [], refunds: [], scholarships: [], batches: [] }
    for (const [slice, rows] of results) {
      if (slice === 'payments') out.payments = rows as DbPayment[]
      else if (slice === 'donations') out.donations = rows as DbDonation[]
      else if (slice === 'refunds') out.refunds = rows as DbRefund[]
      else if (slice === 'scholarships') out.scholarships = rows as Scholarship[]
      else out.batches = rows as DbImportBatch[]
    }
    return out
  })

  // refetch fuerza red (salta la caché): se usa tras mutaciones. Devuelve la
  // promesa para quien haga `await refetch()` antes de navegar.
  const refetch = useCallback(() => { forzarRef.current = true; return recargar() }, [recargar])

  const d = datos ?? NINGUNO
  const dbPayments = d.payments, dbDonations = d.donations, dbRefunds = d.refunds
  const dbScholar = d.scholarships, dbBatches = d.batches

  const payments: Payment[]         = useMemo(() => dbPayments.map(toDomainPayment), [dbPayments])
  const donations: Donation[]       = useMemo(() => dbDonations.map(toDomainDonation), [dbDonations])
  const refunds: Refund[]           = useMemo(() => dbRefunds.map(toDomainRefund), [dbRefunds])
  const scholarships: Scholarship[] = dbScholar
  const importBatches: ImportBatch[] = useMemo(() => dbBatches.map(toDomainImportBatch), [dbBatches])

  return { payments, donations, refunds, scholarships, importBatches, loading: cargando, error, refetch }
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Wallet, Loader2 } from 'lucide-react'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { hasModulePermission } from '@/lib/auth/roles'
import { plata, type SaldoAFavor } from '@/lib/finance/saldo-a-favor'

/**
 * Quién tiene plata a favor.
 *
 * Aparece cuando a alguien se le mueve la matrícula a un estudio más barato o
 * gratis: su pago viaja con ella y lo que sobra queda a su nombre. Sin esta
 * pantalla esa plata existe pero no la ve nadie.
 *
 * El número no está guardado: es lo pagado menos lo que cuesta la matrícula,
 * calculado en el momento. Por eso no puede quedar desactualizado.
 */
export default function SaldosAFavorPage() {
  const { user, loaded } = useAuth()
  const puede = hasModulePermission(user?.roles ?? [], 'finanzas', 'view')

  const [items, setItems] = useState<SaldoAFavor[]>([])
  const [totales, setTotales] = useState<Array<{ currency: string; total: number }>>([])
  const [revisadas, setRevisadas] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    // Sin permiso la pantalla ya devuelve AccessDenied, así que el estado
    // de carga no se llega a mirar: no hace falta tocarlo acá.
    if (!puede) return
    let vivo = true
    fetch('/api/finance/credits')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los saldos.')))
      .then(d => {
        if (!vivo) return
        setItems(d.items ?? []); setTotales(d.totales ?? []); setRevisadas(d.matriculas_revisadas ?? 0)
      })
      .catch(e => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [puede])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return items
    return items.filter(i =>
      i.member_name.toLowerCase().includes(q) || (i.group_name ?? '').toLowerCase().includes(q))
  }, [items, busqueda])

  if (!loaded) return null
  if (!puede) return <AccessDenied />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy font-display">Saldos a favor</h1>
        <p className="text-sm text-navy-light/80 font-body mt-1">
          Plata que la persona ya pagó y que su matrícula actual no consume. Pasa cuando se
          le mueve la matrícula a un estudio más barato o gratis: el pago viaja con ella.
        </p>
      </div>

      {totales.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {totales.map(t => (
            <div key={t.currency} className="rounded-2xl bg-surface-card px-5 py-4 shadow-[var(--shadow-md)]">
              <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Total a favor
              </p>
              <p className="text-2xl font-extrabold text-navy font-display mt-0.5">
                {plata(t.total, t.currency)}
              </p>
              <p className="text-[13px] text-navy-light/80 font-body">
                {items.length} {items.length === 1 ? 'persona' : 'personas'}
              </p>
            </div>
          ))}
        </div>
      )}

      {cargando ? (
        <div className="flex items-center gap-2 py-12 justify-center text-navy-light/80">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          <span className="text-sm font-body">Calculando…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-coral-deep font-body" role="alert">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nadie tiene saldo a favor"
          description={`Se revisaron ${revisadas.toLocaleString('es-CR')} matrículas activas y en todas lo pagado calza con lo que cuesta el estudio.`}
        />
      ) : (
        <>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por persona o grupo…"
            aria-label="Buscar en los saldos a favor"
            className="w-full max-w-md rounded-xl border border-[var(--outline-variant)] px-3 py-2 text-sm font-body"
          />
          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Persona', 'Su estudio actual', 'Pagó', 'Cuesta', 'A favor'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 whitespace-nowrap font-display">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(s => (
                  <tr key={s.enrollment_id} className="border-b border-[var(--outline-variant)] hover:bg-surface-low transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/miembros/${s.member_id}`} className="text-[13px] text-navy hover:underline font-body">
                        {s.member_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{s.group_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{plata(s.pagado, s.currency)}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{plata(s.costo, s.currency)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-teal-deep font-body">{plata(s.saldo, s.currency)}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-[13px] text-navy-light/80 font-body">Nadie con ese nombre.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

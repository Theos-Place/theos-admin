'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { GraduationCap, Plus, Check, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Modal } from '@/components/shared/Modal'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { type Scholarship } from '@/data/mock-finance'
import { useFinance } from '@/hooks/useFinance'
import { TOAST_MS } from '@/lib/constants'
import { formatDate } from '@/lib/format'

export default function BecasPage() {
  const { scholarships: allScholarships, error, refetch } = useFinance()
  const [scholarships, setScholarships] = useState<Scholarship[]>([])
  useEffect(() => { setScholarships(allScholarships) }, [allScholarships])
  const [typeFilter, setTypeFilter] = useState<'all' | 'percentage' | 'fixed'>('all')
  const [entityFilter, setEntityFilter] = useState<'all' | 'event' | 'study_group'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unused' | 'used'>('all')
  const [confirmRevoke, setConfirmRevoke] = useState<Scholarship | null>(null)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_MS)
  }

  const activeCount = scholarships.filter(s => !s.is_used).length
  const usedCount = scholarships.filter(s => s.is_used).length
  const totalDiscounted = scholarships
    .filter(s => s.is_used)
    .reduce((sum, s) => sum + (s.original_amount - s.final_amount), 0)

  const filtered = useMemo(() => {
    return scholarships.filter(s => {
      const matchType = typeFilter === 'all' || s.discount_type === typeFilter
      const matchEntity = entityFilter === 'all' || s.entity_type === entityFilter
      const matchStatus = statusFilter === 'all' || (statusFilter === 'unused' ? !s.is_used : s.is_used)
      return matchType && matchEntity && matchStatus
    })
  }, [scholarships, typeFilter, entityFilter, statusFilter])

  function handleRevoke(s: Scholarship) {
    setScholarships(prev => prev.filter(sc => sc.id !== s.id))
    setConfirmRevoke(null)
    showToast(`Beca revocada para ${s.member_name}`)
  }

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-navy shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.10)]">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">
                Becas y cupones
              </h1>
              <p className="text-[12px] text-white/50 mt-0.5 font-body">
                Descuentos y apoyos económicos
              </p>
            </div>
          </div>
          <Link
            href="/finanzas/becas/nueva"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white transition-all shrink-0 self-start sm:self-auto bg-coral font-body shadow-[0_8px_24px_rgba(239,85,84,0.30)]"
          >
            <Plus size={15} />
            Nueva beca
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[10px] uppercase tracking-widests mb-2 font-display text-[rgba(22,20,64,0.40)]">Becas activas</p>
            <p className="text-4xl font-extrabold font-display text-[#3DB97A]">{activeCount}</p>
          </div>
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[10px] uppercase tracking-widests mb-2 font-display text-[rgba(22,20,64,0.40)]">Usadas</p>
            <p className="text-4xl font-extrabold font-display text-teal-deep">{usedCount}</p>
          </div>
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[10px] uppercase tracking-widests mb-2 font-display text-[rgba(22,20,64,0.40)]">Total descontado</p>
            <p className="text-xl font-extrabold font-display text-navy">
              <AmountDisplay amount={totalDiscounted} defaultHidden={false} />
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1">
            {([['all', 'Todos'], ['percentage', 'Porcentaje'], ['fixed', 'Monto fijo']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setTypeFilter(v)}
                className={`rounded-full px-3 py-2 text-[12px] font-medium border transition-all font-display ${typeFilter === v ? 'bg-navy text-white border-navy' : 'bg-transparent text-navy/60 border-transparent'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([['all', 'Todos'], ['event', 'Eventos'], ['study_group', 'Grupos']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setEntityFilter(v)}
                className={`rounded-full px-3 py-2 text-[12px] font-medium border transition-all font-display ${entityFilter === v ? 'bg-navy text-white border-navy' : 'bg-transparent text-navy/60 border-transparent'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([['all', 'Todos'], ['unused', 'Sin usar'], ['used', 'Usada']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className={`rounded-full px-3 py-2 text-[12px] font-medium border transition-all font-display ${statusFilter === v ? 'bg-navy text-white border-navy' : 'bg-transparent text-navy/60 border-transparent'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Entidad', 'Tipo descuento', 'Valor', 'Monto final', 'Estado', 'Creada por', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widests font-display text-[rgba(22,20,64,0.40)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium font-body text-navy">{s.member_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-body text-navy">{s.entity_name}</p>
                      <p className="text-[11px] text-[rgba(22,20,64,0.40)] font-body">
                        {s.entity_type === 'event' ? 'Evento' : 'Grupo'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{ color: s.discount_type === 'percentage' ? '#519DA2' : '#3DB97A', background: s.discount_type === 'percentage' ? 'rgba(81,157,162,0.12)' : 'rgba(61,185,122,0.10)' }}>
                        {s.discount_type === 'percentage' ? `${s.discount_value}%` : 'Monto fijo'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium font-body text-navy">
                        {s.discount_type === 'percentage'
                          ? `${s.discount_value}%`
                          : `₡${s.discount_value.toLocaleString('es-CR')}`
                        }
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <AmountDisplay amount={s.final_amount} defaultHidden={false} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{ color: s.is_used ? '#519DA2' : '#3DB97A', background: s.is_used ? 'rgba(81,157,162,0.12)' : 'rgba(61,185,122,0.10)' }}>
                        {s.is_used ? 'Usada' : 'Sin usar'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[12px] text-[rgba(22,20,64,0.60)] font-body">{s.created_by}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[12px] whitespace-nowrap text-[rgba(22,20,64,0.55)] font-body">{formatDate(s.created_at)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {!s.is_used && (
                          <button
                            onClick={() => setConfirmRevoke(s)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(239,85,84,0.30)] text-coral font-body"
                          >
                            Revocar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      {error
                        ? <ErrorState message={error} onRetry={refetch} />
                        : <EmptyState icon={GraduationCap} title="No hay becas que coincidan con los filtros" />}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {filtered.map((s, i) => (
              <li
                key={s.id}
                className="px-4 py-3 space-y-2.5"
                style={i < filtered.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium font-body text-navy truncate">{s.member_name}</p>
                    <p className="text-[12px] text-[rgba(22,20,64,0.55)] font-body truncate">{s.entity_name}</p>
                    <p className="text-[11px] text-[rgba(22,20,64,0.45)] font-body mt-0.5">
                      {s.discount_type === 'percentage' ? `${s.discount_value}%` : `₡${s.discount_value.toLocaleString('es-CR')}`}
                      {' · '}{formatDate(s.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[13px] font-medium font-body text-navy">
                      <AmountDisplay amount={s.final_amount} defaultHidden={false} />
                    </p>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ color: s.is_used ? '#519DA2' : '#3DB97A', background: s.is_used ? 'rgba(81,157,162,0.12)' : 'rgba(61,185,122,0.10)' }}>
                      {s.is_used ? 'Usada' : 'Sin usar'}
                    </span>
                  </div>
                </div>
                {!s.is_used && (
                  <div className="flex">
                    <button
                      onClick={() => setConfirmRevoke(s)}
                      className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(239,85,84,0.30)] text-coral font-body"
                    >
                      Revocar
                    </button>
                  </div>
                )}
              </li>
            ))}
            {filtered.length === 0 && (
              <li>
                {error
                  ? <ErrorState message={error} onRetry={refetch} />
                  : <EmptyState icon={GraduationCap} title="No hay becas que coincidan con los filtros" />}
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Revoke confirm modal */}
      {confirmRevoke && (
        <Modal onClose={() => setConfirmRevoke(null)} titleId="revocar-beca" width={384}>
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[rgba(239,85,84,0.10)]">
                <AlertTriangle size={18} className="text-coral" />
              </div>
              <div>
                <p id="revocar-beca" className="text-sm font-bold font-display text-navy">¿Revocar esta beca?</p>
                <p className="text-[12px] font-body text-[rgba(22,20,64,0.50)]">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed font-body text-[rgba(22,20,64,0.70)]">
              La beca de <strong>{confirmRevoke.member_name}</strong> para <strong>{confirmRevoke.entity_name}</strong> será eliminada.
            </p>
          </div>
          <div className="px-6 py-4 border-t flex gap-3 border-[var(--outline-variant)]">
            <button onClick={() => setConfirmRevoke(null)}
              className="flex-1 rounded-full border py-2.5 text-sm border-[var(--outline-variant)] font-body text-[rgba(22,20,64,0.70)]">
              Cancelar
            </button>
            <button onClick={() => handleRevoke(confirmRevoke)}
              className="flex-1 rounded-full py-2.5 text-sm text-white bg-coral font-body">
              Revocar
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body">
          <Check size={15} className="text-[#3DB97A]" />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}

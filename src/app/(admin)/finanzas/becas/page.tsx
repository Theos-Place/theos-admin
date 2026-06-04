'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { GraduationCap, Plus, Check, AlertTriangle } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { type Scholarship } from '@/data/mock-finance'
import { useFinance } from '@/hooks/useFinance'
import { TOAST_MS } from '@/lib/constants'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BecasPage() {
  const { scholarships: allScholarships } = useFinance()
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
          className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: '#161440', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.10)' }}>
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Becas y cupones
              </h1>
              <p className="text-[12px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                Descuentos y apoyos económicos
              </p>
            </div>
          </div>
          <Link
            href="/finanzas/becas/nueva"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white transition-all shrink-0 self-start sm:self-auto"
            style={{ background: '#EF5554', fontFamily: 'var(--font-body)', boxShadow: '0 8px 24px rgba(239,85,84,0.30)' }}
          >
            <Plus size={15} />
            Nueva beca
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[10px] uppercase tracking-widests mb-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Becas activas</p>
            <p className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: '#3DB97A' }}>{activeCount}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[10px] uppercase tracking-widests mb-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Usadas</p>
            <p className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: '#519DA2' }}>{usedCount}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[10px] uppercase tracking-widests mb-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Total descontado</p>
            <p className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
              <AmountDisplay amount={totalDiscounted} defaultHidden={false} />
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1">
            {([['all', 'Todos'], ['percentage', 'Porcentaje'], ['fixed', 'Monto fijo']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setTypeFilter(v)}
                className="rounded-full px-3 py-2 text-[12px] font-medium border transition-all"
                style={{ background: typeFilter === v ? '#161440' : 'transparent', color: typeFilter === v ? 'white' : 'rgba(22,20,64,0.60)', borderColor: typeFilter === v ? '#161440' : 'transparent', fontFamily: 'var(--font-display)' }}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([['all', 'Todos'], ['event', 'Eventos'], ['study_group', 'Grupos']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setEntityFilter(v)}
                className="rounded-full px-3 py-2 text-[12px] font-medium border transition-all"
                style={{ background: entityFilter === v ? '#161440' : 'transparent', color: entityFilter === v ? 'white' : 'rgba(22,20,64,0.60)', borderColor: entityFilter === v ? '#161440' : 'transparent', fontFamily: 'var(--font-display)' }}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([['all', 'Todos'], ['unused', 'Sin usar'], ['used', 'Usada']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className="rounded-full px-3 py-2 text-[12px] font-medium border transition-all"
                style={{ background: statusFilter === v ? '#161440' : 'transparent', color: statusFilter === v ? 'white' : 'rgba(22,20,64,0.60)', borderColor: statusFilter === v ? '#161440' : 'transparent', fontFamily: 'var(--font-display)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                  {['Miembro', 'Entidad', 'Tipo descuento', 'Valor', 'Monto final', 'Estado', 'Creada por', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widests"
                      style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{s.member_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{s.entity_name}</p>
                      <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.40)', fontFamily: 'var(--font-body)' }}>
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
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
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
                      <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.60)', fontFamily: 'var(--font-body)' }}>{s.created_by}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[12px] whitespace-nowrap" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>{formatDate(s.created_at)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {!s.is_used && (
                          <button
                            onClick={() => setConfirmRevoke(s)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap"
                            style={{ borderColor: 'rgba(239,85,84,0.30)', color: '#EF5554', fontFamily: 'var(--font-body)' }}
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
                    <td colSpan={9} className="px-5 py-12 text-center text-sm" style={{ color: 'rgba(22,20,64,0.40)', fontFamily: 'var(--font-body)' }}>
                      No hay becas que coincidan con los filtros
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Revoke confirm modal */}
      {confirmRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,20,64,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,85,84,0.10)' }}>
                  <AlertTriangle size={18} style={{ color: '#EF5554' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>¿Revocar esta beca?</p>
                  <p className="text-[12px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.50)' }}>Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>
                La beca de <strong>{confirmRevoke.member_name}</strong> para <strong>{confirmRevoke.entity_name}</strong> será eliminada.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
              <button onClick={() => setConfirmRevoke(null)}
                className="flex-1 rounded-full border py-2.5 text-sm"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>
                Cancelar
              </button>
              <button onClick={() => handleRevoke(confirmRevoke)}
                className="flex-1 rounded-full py-2.5 text-sm text-white"
                style={{ background: '#EF5554', fontFamily: 'var(--font-body)' }}>
                Revocar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white"
          style={{ background: '#161440', boxShadow: '0 12px 32px rgba(22,20,64,0.20)', fontFamily: 'var(--font-body)' }}>
          <Check size={15} style={{ color: '#3DB97A' }} />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}

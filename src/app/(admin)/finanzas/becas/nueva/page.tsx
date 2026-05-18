'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Check, X } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { mockMembers } from '@/data/mock-members'

const EVENTS = [
  { id: 'evt-camp-jun25', name: 'Campamento Junio 2025', amount: 45000 },
  { id: 'evt-retiro-lid', name: 'Retiro de Liderazgo', amount: 25000 },
  { id: 'evt-taller-fin', name: 'Taller de Finanzas', amount: 15000 },
  { id: 'evt-adoracion',  name: 'Noche de Adoración', amount: 8000 },
  { id: 'evt-camp-ver26', name: 'Campamento Verano 2026', amount: 55000 },
]

const GROUPS = [
  { id: 'grp-alpha',    name: 'Grupo Alpha',    amount: 20000 },
  { id: 'grp-omega',    name: 'Grupo Omega',     amount: 15000 },
  { id: 'grp-genesis',  name: 'Grupo Génesis',   amount: 30000 },
  { id: 'grp-esperanza',name: 'Grupo Esperanza', amount: 20000 },
]

export default function NuevaBecaPage() {
  const router = useRouter()

  const [memberQuery, setMemberQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<typeof mockMembers[0] | null>(null)
  const [entityType, setEntityType] = useState<'event' | 'study_group'>('event')
  const [entityQuery, setEntityQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; name: string; amount: number } | null>(null)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [percentage, setPercentage] = useState(50)
  const [fixedAmount, setFixedAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const memberResults = useMemo(() => {
    if (!memberQuery.trim() || selectedMember) return []
    const q = memberQuery.toLowerCase()
    return mockMembers.filter(m =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      (m.cedula ?? '').includes(q)
    ).slice(0, 6)
  }, [memberQuery, selectedMember])

  const entityList = entityType === 'event' ? EVENTS : GROUPS
  const entityResults = useMemo(() => {
    if (!entityQuery.trim() || selectedEntity) return []
    const q = entityQuery.toLowerCase()
    return entityList.filter(e => e.name.toLowerCase().includes(q)).slice(0, 6)
  }, [entityQuery, selectedEntity, entityList])

  const originalAmount = selectedEntity?.amount ?? 0
  const discountAmount = discountType === 'percentage'
    ? Math.round(originalAmount * percentage / 100)
    : Math.min(Number(fixedAmount) || 0, originalAmount)
  const finalAmount = Math.max(0, originalAmount - discountAmount)
  const effectivePercentage = originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 100) : 0
  const isFullScholarship = discountType === 'percentage' ? percentage === 100 : discountAmount >= originalAmount

  function handleCreate() {
    if (!selectedMember || !selectedEntity) return
    showToast('Beca creada exitosamente')
    setTimeout(() => router.push('/finanzas/becas'), 1500)
  }

  return (
    <FinanceGuard>
      <div className="space-y-6 max-w-2xl mx-auto">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center gap-3"
          style={{ background: '#161440', boxShadow: 'var(--shadow-md)' }}
        >
          <button
            onClick={() => router.push('/finanzas/becas')}
            className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all"
            style={{ color: 'rgba(255,255,255,0.60)' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>Nueva beca</h1>
            <p className="text-[12px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              Asignar descuento o apoyo económico
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-6 space-y-6" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>

          {/* 1. Member search */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              1. Miembro
            </label>
            {selectedMember ? (
              <div className="flex items-center gap-3 rounded-xl p-3.5" style={{ background: 'rgba(112,189,194,0.08)', border: '1px solid rgba(112,189,194,0.25)' }}>
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: '#161440', fontFamily: 'var(--font-display)' }}>
                  {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{selectedMember.first_name} {selectedMember.last_name}</p>
                  <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>{selectedMember.cedula ?? 'Sin cédula'}</p>
                </div>
                <button onClick={() => { setSelectedMember(null); setMemberQuery('') }}>
                  <X size={16} style={{ color: 'rgba(22,20,64,0.40)' }} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--outline-variant)' }}>
                  <Search size={14} style={{ color: 'rgba(22,20,64,0.40)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o cédula..."
                    value={memberQuery}
                    onChange={e => setMemberQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ fontFamily: 'var(--font-body)', color: '#161440' }}
                  />
                </div>
                {memberResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border overflow-hidden z-10" style={{ borderColor: 'var(--outline-variant)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                    {memberResults.map(m => (
                      <button key={m.id} onClick={() => { setSelectedMember(m); setMemberQuery('') }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-low transition-colors border-b last:border-0 text-left"
                        style={{ borderColor: 'var(--outline-variant)' }}>
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: '#161440', fontFamily: 'var(--font-display)' }}>
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{m.first_name} {m.last_name}</p>
                          <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>{m.cedula ?? 'Sin cédula'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Entity type */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              2. Tipo de entidad
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([['event', 'Evento'], ['study_group', 'Grupo de estudio']] as const).map(([v, l]) => (
                <button key={v} onClick={() => { setEntityType(v); setSelectedEntity(null); setEntityQuery('') }}
                  className="rounded-xl p-3 text-sm font-medium border transition-all text-left"
                  style={{ borderColor: entityType === v ? '#EF5554' : 'var(--outline-variant)', background: entityType === v ? 'rgba(239,85,84,0.05)' : 'var(--surface-low)', color: entityType === v ? '#EF5554' : 'rgba(22,20,64,0.70)', fontFamily: 'var(--font-body)' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Entity search */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              3. {entityType === 'event' ? 'Evento' : 'Grupo'}
            </label>
            {selectedEntity ? (
              <div className="flex items-center gap-3 rounded-xl p-3.5" style={{ background: 'rgba(112,189,194,0.08)', border: '1px solid rgba(112,189,194,0.25)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{selectedEntity.name}</p>
                  <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>
                    ₡{selectedEntity.amount.toLocaleString('es-CR')}
                  </p>
                </div>
                <button onClick={() => { setSelectedEntity(null); setEntityQuery('') }}>
                  <X size={16} style={{ color: 'rgba(22,20,64,0.40)' }} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--outline-variant)' }}>
                  <Search size={14} style={{ color: 'rgba(22,20,64,0.40)' }} />
                  <input
                    type="text"
                    placeholder={`Buscar ${entityType === 'event' ? 'evento' : 'grupo'}...`}
                    value={entityQuery}
                    onChange={e => setEntityQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ fontFamily: 'var(--font-body)', color: '#161440' }}
                  />
                </div>
                {entityResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border overflow-hidden z-10" style={{ borderColor: 'var(--outline-variant)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                    {entityResults.map(e => (
                      <button key={e.id} onClick={() => { setSelectedEntity(e); setEntityQuery('') }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-low transition-colors border-b last:border-0 text-left"
                        style={{ borderColor: 'var(--outline-variant)' }}>
                        <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{e.name}</p>
                        <p className="text-[12px]" style={{ color: '#519DA2', fontFamily: 'var(--font-body)' }}>₡{e.amount.toLocaleString('es-CR')}</p>
                      </button>
                    ))}
                  </div>
                )}
                {entityQuery && entityResults.length === 0 && (
                  <div className="mt-2">
                    <p className="text-[12px] px-2" style={{ color: 'rgba(22,20,64,0.40)', fontFamily: 'var(--font-body)' }}>
                      Opciones disponibles:
                    </p>
                    <div className="mt-1 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--outline-variant)' }}>
                      {entityList.map(e => (
                        <button key={e.id} onClick={() => { setSelectedEntity(e); setEntityQuery('') }}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-low transition-colors border-b last:border-0 text-left"
                          style={{ borderColor: 'var(--outline-variant)' }}>
                          <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{e.name}</p>
                          <p className="text-[12px]" style={{ color: '#519DA2', fontFamily: 'var(--font-body)' }}>₡{e.amount.toLocaleString('es-CR')}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Discount type */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              4. Tipo de descuento
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {([['percentage', 'Porcentaje'], ['fixed', 'Monto fijo']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setDiscountType(v)}
                  className="rounded-xl p-3 text-sm font-medium border transition-all text-left"
                  style={{ borderColor: discountType === v ? '#EF5554' : 'var(--outline-variant)', background: discountType === v ? 'rgba(239,85,84,0.05)' : 'var(--surface-low)', color: discountType === v ? '#EF5554' : 'rgba(22,20,64,0.70)', fontFamily: 'var(--font-body)' }}>
                  {l}
                </button>
              ))}
            </div>

            {discountType === 'percentage' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0} max={100} step={5}
                    value={percentage}
                    onChange={e => setPercentage(Number(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: '#EF5554' }}
                  />
                  <input
                    type="number"
                    min={0} max={100}
                    value={percentage}
                    onChange={e => setPercentage(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="w-20 rounded-xl border px-3 py-2 text-sm text-center outline-none"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
                  />
                  <span className="text-sm font-medium" style={{ color: '#161440', fontFamily: 'var(--font-body)' }}>%</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: '#161440', fontFamily: 'var(--font-display)' }}>₡</span>
                <input
                  type="number"
                  min={0}
                  value={fixedAmount}
                  onChange={e => setFixedAmount(e.target.value)}
                  placeholder="Monto del descuento"
                  className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
                />
              </div>
            )}
          </div>

          {/* 5. Calculator */}
          {selectedEntity && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(22,20,64,0.10)' }}>
              <div className="px-5 py-4 space-y-2" style={{ background: 'rgba(22,20,64,0.03)' }}>
                <div className="flex justify-between text-sm" style={{ fontFamily: 'var(--font-body)' }}>
                  <span style={{ color: 'rgba(22,20,64,0.55)' }}>Costo original:</span>
                  <span style={{ color: '#161440' }}>₡{originalAmount.toLocaleString('es-CR')}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ fontFamily: 'var(--font-body)' }}>
                  <span style={{ color: 'rgba(22,20,64,0.55)' }}>
                    Descuento ({discountType === 'percentage' ? `${percentage}%` : 'fijo'}):
                  </span>
                  <span style={{ color: '#EF5554' }}>-₡{discountAmount.toLocaleString('es-CR')}</span>
                </div>
                <div className="h-px" style={{ background: 'rgba(22,20,64,0.10)' }} />
                <div className="flex justify-between text-sm font-bold" style={{ fontFamily: 'var(--font-body)' }}>
                  <span style={{ color: '#161440' }}>Costo final:</span>
                  <span style={{ color: '#3DB97A' }}>₡{finalAmount.toLocaleString('es-CR')}</span>
                </div>
              </div>
              {isFullScholarship && (
                <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(61,185,122,0.10)' }}>
                  <Check size={14} style={{ color: '#3DB97A', flexShrink: 0 }} />
                  <p className="text-[12px] font-medium" style={{ color: '#1E6B42', fontFamily: 'var(--font-body)' }}>
                    Beca completa — inscripción gratuita
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 6. Notes */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Motivo de la beca, observaciones..."
              rows={3}
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none resize-none"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={!selectedMember || !selectedEntity}
            className="w-full rounded-full py-3 text-sm text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#EF5554', fontFamily: 'var(--font-body)' }}
          >
            Crear beca
          </button>
        </div>
      </div>

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

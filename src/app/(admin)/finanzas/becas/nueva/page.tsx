'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Check, X } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { useEvents } from '@/hooks/useEvents'
import { useStudies } from '@/hooks/useStudies'
import { TOAST_MS, REDIRECT_AFTER_SAVE_MS } from '@/lib/constants'

type EntityOption = { id: string; name: string; amount: number }

export default function NuevaBecaPage() {
  const router = useRouter()
  const { events } = useEvents()
  const { groups, studyTypes } = useStudies()

  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null)
  const [entityType, setEntityType] = useState<'event' | 'study_group'>('event')
  const [entityQuery, setEntityQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [percentage, setPercentage] = useState(50)
  const [fixedAmount, setFixedAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_MS)
  }

  // Eventos con pago y grupos de estudio (costo del plan) como opciones reales.
  const EVENTS: EntityOption[] = useMemo(
    () => events.filter(e => e.requires_payment).map(e => ({ id: e.id, name: e.name, amount: e.payment_amount ?? 0 })),
    [events],
  )
  const GROUPS: EntityOption[] = useMemo(
    () => groups.map(g => {
      const plan = studyTypes.find(t => t.code === g.study_type_id)
      const label = [plan?.name ?? g.study_type_id, g.zone].filter(Boolean).join(' — ')
      return { id: g.id, name: label, amount: plan?.cost ?? 0 }
    }),
    [groups, studyTypes],
  )

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

  async function handleCreate() {
    if (!selectedMember || !selectedEntity || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/finance/scholarships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMember.id,
          entity_type: entityType,
          event_id: entityType === 'event' ? selectedEntity.id : null,
          study_group_id: entityType === 'study_group' ? selectedEntity.id : null,
          discount_type: discountType,
          discount_value: discountType === 'percentage' ? percentage : discountAmount,
          original_amount: originalAmount,
          final_amount: finalAmount,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      showToast('Beca creada exitosamente')
      setTimeout(() => router.push('/finanzas/becas'), REDIRECT_AFTER_SAVE_MS)
    } catch {
      setSaving(false)
      showToast('Error al crear la beca')
    }
  }

  return (
    <FinanceGuard>
      <div className="space-y-6 max-w-2xl mx-auto">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center gap-3 bg-navy shadow-[var(--shadow-md)]"
        >
          <button
            onClick={() => router.push('/finanzas/becas')}
            className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all text-[rgba(255,255,255,0.60)]"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">Nueva beca</h1>
            <p className="text-[12px] text-white/70 mt-0.5 font-body">
              Asignar descuento o apoyo económico
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-6 space-y-6 bg-surface-card shadow-[var(--shadow-md)]">

          {/* 1. Member search */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block font-display text-[rgba(22,20,64,0.60)]">
              1. Miembro
            </label>
            {selectedMember ? (
              <div className="flex items-center gap-3 rounded-xl p-3.5 bg-[rgba(112,189,194,0.08)] border border-[rgba(112,189,194,0.25)]">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 bg-navy font-display">
                  {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-body text-navy">{selectedMember.first_name} {selectedMember.last_name}</p>
                  <p className="text-[12px] text-[rgba(22,20,64,0.60)] font-body">{selectedMember.cedula ?? 'Sin cédula'}</p>
                </div>
                <button onClick={() => setSelectedMember(null)} aria-label="Quitar miembro seleccionado">
                  <X size={16} className="text-[rgba(22,20,64,0.60)]" />
                </button>
              </div>
            ) : (
              <MemberCombobox
                dropdown
                pageSize={6}
                placeholder="Buscar por nombre o cédula..."
                onSelect={setSelectedMember}
              />
            )}
          </div>

          {/* 2. Entity type */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block font-display text-[rgba(22,20,64,0.60)]">
              2. Tipo de entidad
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([['event', 'Evento'], ['study_group', 'Grupo de estudio']] as const).map(([v, l]) => (
                <button key={v} onClick={() => { setEntityType(v); setSelectedEntity(null); setEntityQuery('') }}
                  className={`rounded-xl p-3 text-sm font-medium border transition-all text-left font-body ${entityType === v ? 'border-coral bg-coral/5 text-coral' : 'border-outline bg-surface-low text-navy/70'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Entity search */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block font-display text-[rgba(22,20,64,0.60)]">
              3. {entityType === 'event' ? 'Evento' : 'Grupo'}
            </label>
            {selectedEntity ? (
              <div className="flex items-center gap-3 rounded-xl p-3.5 bg-[rgba(112,189,194,0.08)] border border-[rgba(112,189,194,0.25)]">
                <div className="flex-1">
                  <p className="text-sm font-medium font-body text-navy">{selectedEntity.name}</p>
                  <p className="text-[12px] text-[rgba(22,20,64,0.60)] font-body">
                    ₡{selectedEntity.amount.toLocaleString('es-CR')}
                  </p>
                </div>
                <button onClick={() => { setSelectedEntity(null); setEntityQuery('') }}>
                  <X size={16} className="text-[rgba(22,20,64,0.60)]" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 border-[var(--outline-variant)]">
                  <Search size={14} className="text-[rgba(22,20,64,0.60)]" />
                  <input
                    type="text"
                    placeholder={`Buscar ${entityType === 'event' ? 'evento' : 'grupo'}...`}
                    value={entityQuery}
                    onChange={e => setEntityQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none font-body text-navy"
                  />
                </div>
                {entityResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border overflow-hidden z-10 border-[var(--outline-variant)] bg-surface-card shadow-[var(--shadow-md)]">
                    {entityResults.map(e => (
                      <button key={e.id} onClick={() => { setSelectedEntity(e); setEntityQuery('') }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-low transition-colors border-b last:border-0 text-left border-[var(--outline-variant)]">
                        <p className="text-[13px] font-medium font-body text-navy">{e.name}</p>
                        <p className="text-[12px] text-teal-deep font-body">₡{e.amount.toLocaleString('es-CR')}</p>
                      </button>
                    ))}
                  </div>
                )}
                {entityQuery && entityResults.length === 0 && (
                  <div className="mt-2">
                    <p className="text-[12px] px-2 text-[rgba(22,20,64,0.60)] font-body">
                      Opciones disponibles:
                    </p>
                    <div className="mt-1 rounded-xl border overflow-hidden border-[var(--outline-variant)]">
                      {entityList.map(e => (
                        <button key={e.id} onClick={() => { setSelectedEntity(e); setEntityQuery('') }}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-low transition-colors border-b last:border-0 text-left border-[var(--outline-variant)]">
                          <p className="text-[13px] font-body text-navy">{e.name}</p>
                          <p className="text-[12px] text-teal-deep font-body">₡{e.amount.toLocaleString('es-CR')}</p>
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
            <label className="text-[11px] uppercase tracking-widests mb-2 block font-display text-[rgba(22,20,64,0.60)]">
              4. Tipo de descuento
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {([['percentage', 'Porcentaje'], ['fixed', 'Monto fijo']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setDiscountType(v)}
                  className={`rounded-xl p-3 text-sm font-medium border transition-all text-left font-body ${discountType === v ? 'border-coral bg-coral/5 text-coral' : 'border-outline bg-surface-low text-navy/70'}`}>
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
                    className="flex-1 accent-[#EF5554]"
                  />
                  <input
                    type="number"
                    min={0} max={100}
                    value={percentage}
                    onChange={e => setPercentage(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="w-20 rounded-xl border px-3 py-2 text-sm text-center outline-none border-[var(--outline-variant)] font-body text-navy"
                  />
                  <span className="text-sm font-medium text-navy font-body">%</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-navy font-display">₡</span>
                <input
                  type="number"
                  min={0}
                  value={fixedAmount}
                  onChange={e => setFixedAmount(e.target.value)}
                  placeholder="Monto del descuento"
                  className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy"
                />
              </div>
            )}
          </div>

          {/* 5. Calculator */}
          {selectedEntity && (
            <div className="rounded-xl overflow-hidden border border-[rgba(22,20,64,0.10)]">
              <div className="px-5 py-4 space-y-2 bg-[rgba(22,20,64,0.03)]">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-[rgba(22,20,64,0.55)]">Costo original:</span>
                  <span className="text-navy">₡{originalAmount.toLocaleString('es-CR')}</span>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-[rgba(22,20,64,0.55)]">
                    Descuento ({discountType === 'percentage' ? `${percentage}%` : 'fijo'}):
                  </span>
                  <span className="text-coral">-₡{discountAmount.toLocaleString('es-CR')}</span>
                </div>
                <div className="h-px bg-[rgba(22,20,64,0.10)]" />
                <div className="flex justify-between text-sm font-bold font-body">
                  <span className="text-navy">Costo final:</span>
                  <span className="text-[#3DB97A]">₡{finalAmount.toLocaleString('es-CR')}</span>
                </div>
              </div>
              {isFullScholarship && (
                <div className="px-5 py-3 flex items-center gap-2 bg-[rgba(61,185,122,0.10)]">
                  <Check size={14} className="text-[#3DB97A] shrink-0" />
                  <p className="text-[12px] font-medium text-[#1E6B42] font-body">
                    Beca completa — inscripción gratuita
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 6. Notes */}
          <div>
            <label className="text-[11px] uppercase tracking-widests mb-2 block font-display text-[rgba(22,20,64,0.60)]">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Motivo de la beca, observaciones..."
              rows={3}
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none resize-none border-[var(--outline-variant)] font-body text-navy"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={!selectedMember || !selectedEntity || saving}
            className="w-full rounded-full py-3 text-sm text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-coral font-body"
          >
            {saving ? 'Creando...' : 'Crear beca'}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body">
          <Check size={15} className="text-[#3DB97A]" />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}

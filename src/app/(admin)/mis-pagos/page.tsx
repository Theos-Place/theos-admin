'use client'

// PAG-1: pagos pendientes del propio miembro (y su familia). Cualquier sesión;
// el endpoint /api/members/[id]/payments gatea a self/familia/staff. Deep link
// ?pago=<id> (viene de las notificaciones internas) resalta ese pago.

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { MemberPaymentsList } from '@/components/members/MemberPaymentsList'

export default function MisPagosPage() {
  const { user, loaded } = useAuth()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('pago')

  const selfId = user?.member_id ?? null
  const familyIds = (user?.family_member_ids ?? []).filter(id => id !== selfId)
  const [selected, setSelected] = useState<string | null>(null)
  const [familyNames, setFamilyNames] = useState<Record<string, string>>({})
  const memberId = selected ?? selfId

  // Nombres de los familiares para las pestañas (el endpoint de perfil permite
  // ver a la propia familia; si algo falla, se muestra "Familiar").
  useEffect(() => {
    let alive = true
    familyIds.forEach(id => {
      if (familyNames[id]) return
      fetch(`/api/members/${id}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!alive || !d) return
          const name = `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || 'Familiar'
          setFamilyNames(prev => ({ ...prev, [id]: name }))
        })
        .catch(() => {})
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyIds.join(',')])

  const [showAll, setShowAll] = useState(false)

  if (loaded && !selfId) {
    return (
      <div className="page max-w-2xl mx-auto">
        <p className="rounded-2xl bg-surface-card p-6 text-sm text-navy-light/70 font-body">Tu sesión no tiene un perfil de miembro asociado.</p>
      </div>
    )
  }

  return (
    <div className="page max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/10"><CreditCard size={20} className="text-coral" /></div>
        <div>
          <h1 className="text-xl font-bold text-navy font-display">Mis pagos</h1>
          <p className="text-[13px] text-navy-light/70 font-body">Pagos pendientes y en revisión. Subí el comprobante para completarlos.</p>
        </div>
      </div>

      {familyIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Pagos de mi familia">
          <button
            role="tab"
            aria-selected={memberId === selfId}
            onClick={() => setSelected(null)}
            className={cn('rounded-full px-3 py-1 text-[12px] font-medium border transition-all font-display',
              memberId === selfId ? 'bg-navy/80 text-white border-navy/80' : 'text-navy-light/60 hover:text-navy border-navy/15')}
          >
            Míos
          </button>
          {familyIds.map(id => (
            <button
              key={id}
              role="tab"
              aria-selected={memberId === id}
              onClick={() => setSelected(id)}
              className={cn('rounded-full px-3 py-1 text-[12px] font-medium border transition-all font-display',
                memberId === id ? 'bg-navy/80 text-white border-navy/80' : 'text-navy-light/60 hover:text-navy border-navy/15')}
            >
              {familyNames[id] ?? 'Familiar'}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        {memberId ? (
          <MemberPaymentsList key={memberId} memberId={memberId} highlightId={highlightId} onlyActionable={!showAll} />
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-navy-light/50 font-body">Cargando…</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowAll(v => !v)}
        className="text-[12px] text-navy-light/60 hover:text-coral transition-colors font-body"
      >
        {showAll ? 'Ocultar historial' : 'Ver también el historial de pagos cerrados'}
      </button>
    </div>
  )
}

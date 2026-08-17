'use client'

// PAG-1: pagos pendientes del propio miembro (y su familia). Cualquier sesión;
// el endpoint /api/members/[id]/payments gatea a self/familia/staff. Deep link
// ?pago=<id> (viene de las notificaciones internas) resalta ese pago.
// PAG-4: renombrada a "Pagos pendientes", full-width responsive, link al
// historial del perfil (acordeón abierto vía ?tab=participacion&open=pagos) y
// sección "Mis becas" (becas ASIGNADAS del miembro, solo lectura).

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CreditCard, GraduationCap, History } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { MemberPaymentsList } from '@/components/members/MemberPaymentsList'
import { StudyRequestActions } from '@/components/studies/StudyRequestActions'
import { formatDate } from '@/lib/format'

type ScholarshipRow = {
  id: string
  entity_name: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  status: 'active' | 'used' | 'revoked'
  used_at: string | null
  created_at: string
}

const SCHOLARSHIP_BADGE: Record<ScholarshipRow['status'], { label: string; cls: string }> = {
  active: { label: 'Activa', cls: 'bg-teal-soft/30 text-teal-deep' },
  used: { label: 'Usada', cls: 'bg-navy/8 text-navy-light/70' },
  revoked: { label: 'Revocada', cls: 'bg-coral/10 text-coral' },
}

function discountLabel(s: ScholarshipRow) {
  return s.discount_type === 'percentage' ? `${s.discount_value}%` : `₡${Number(s.discount_value).toLocaleString('es-CR')}`
}

// Sección "Mis becas": becas asignadas al miembro (las genéricas con código no
// se listan). Solo lectura; el guard del endpoint acota a self/familia/staff.
function MemberScholarships({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<ScholarshipRow[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/members/${memberId}/scholarships`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setRows(d?.items ?? []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [memberId])

  const actives = (rows ?? []).filter(s => s.status === 'active')

  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--outline-variant)]">
        <GraduationCap size={15} className="text-teal-deep" />
        <h2 className="text-[13px] font-bold text-navy font-display">Mis becas</h2>
      </div>
      {actives.length > 0 && (
        <p className="mx-4 mt-3 rounded-xl bg-teal-soft/20 px-3 py-2 text-[12px] text-teal-deep font-body">
          Tenés {actives.length === 1 ? 'una beca activa' : `${actives.length} becas activas`} — se aplica automáticamente al pagar
          {actives.length === 1 ? ` ${actives[0].entity_name}` : ' lo que corresponda'}.
        </p>
      )}
      {rows === null ? (
        <p className="px-4 py-6 text-center text-[13px] text-navy-light/70 font-body">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-navy-light/70 font-body">Sin becas asignadas.</p>
      ) : (
        <div className="divide-y divide-[var(--outline-variant)]">
          {rows.map(s => (
            <div key={s.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] text-navy font-body truncate">{s.entity_name}</p>
                <p className="text-[12px] text-navy-light/70 font-body">
                  Descuento de {discountLabel(s)}{s.used_at ? ` · usada el ${formatDate(s.used_at)}` : ''}
                </p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold font-display', SCHOLARSHIP_BADGE[s.status].cls)}>
                {SCHOLARSHIP_BADGE[s.status].label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MisPagosContent() {
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
      <div className="page">
        <p className="rounded-2xl bg-surface-card p-6 text-sm text-navy-light/70 font-body">Tu sesión no tiene un perfil de miembro asociado.</p>
      </div>
    )
  }

  return (
    <div className="page space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/10 shrink-0"><CreditCard size={20} className="text-coral" /></div>
          <div>
            <h1 className="text-xl font-bold text-navy font-display">Pagos pendientes</h1>
            <p className="text-[13px] text-navy-light/70 font-body">Subí el comprobante para completar tus pagos pendientes o en revisión.</p>
          </div>
        </div>
        {memberId && (
          <Link
            href={`/miembros/${memberId}?tab=participacion&open=pagos`}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-navy/15 px-3.5 py-1.5 text-[12px] text-navy-light hover:text-navy hover:border-navy/30 transition-colors font-body"
          >
            <History size={13} /> Ver historial de pagos
          </Link>
        )}
      </div>

      {familyIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Pagos de mi familia">
          <button
            role="tab"
            aria-selected={memberId === selfId}
            onClick={() => setSelected(null)}
            className={cn('rounded-full px-3 py-1 text-[12px] font-medium border transition-all font-display',
              memberId === selfId ? 'bg-navy/80 text-white border-navy/80' : 'text-navy-light/70 hover:text-navy border-navy/15')}
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
                memberId === id ? 'bg-navy/80 text-white border-navy/80' : 'text-navy-light/70 hover:text-navy border-navy/15')}
            >
              {familyNames[id] ?? 'Familiar'}
            </button>
          ))}
        </div>
      )}

      {/* Full width: pagos (2/3) + becas (1/3) en desktop; apilado en móvil. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            {memberId ? (
              <MemberPaymentsList key={memberId} memberId={memberId} highlightId={highlightId} onlyActionable={!showAll} />
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-navy-light/70 font-body">Cargando…</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="text-[12px] text-navy-light/70 hover:text-coral transition-colors font-body"
            >
              {showAll ? 'Ocultar pagos cerrados' : 'Ver también los pagos cerrados'}
            </button>
            {/* REU-2 · Tercera entrada al cambio de grupo: acá es donde el
                miembro ve sus estudios (el cobro de la matrícula). */}
            {memberId && (
              <StudyRequestActions memberId={memberId} only="relocation" variant="link" />
            )}
          </div>
        </div>

        {memberId && <MemberScholarships key={memberId} memberId={memberId} />}
      </div>
    </div>
  )
}

export default function MisPagosPage() {
  return (
    <Suspense fallback={<div className="page"><p className="text-sm text-navy-light/70 font-body">Cargando…</p></div>}>
      <MisPagosContent />
    </Suspense>
  )
}

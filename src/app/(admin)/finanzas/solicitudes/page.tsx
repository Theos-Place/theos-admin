'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Lock, Loader2, GraduationCap, CreditCard, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { RequestBoard } from '@/components/shared/RequestBoard'
import type { FinanceRequest } from '@/types/finance'

const TABS = [
  { key: 'scholarship', label: 'Becas' },
  { key: 'refund', label: 'Devoluciones' },
]

const TYPE_LABEL: Record<string, string> = {
  scholarship: 'Beca',
  refund: 'Devolución',
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n)
}

export default function FinanzasSolicitudesPage() {
  const { user, loaded, hasRole } = useAuth()
  const [requests, setRequests] = useState<FinanceRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Ver/gestionar: solo finanzas y admin.
  const allowed = hasRole('finanzas', 'admin')

  useEffect(() => {
    if (!allowed) return
    let alive = true
    fetch('/api/finance/requests')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) { setRequests(Array.isArray(d) ? d : []); setLoading(false) } })
      .catch(() => { if (alive) { setRequests([]); setLoading(false) } })
    return () => { alive = false }
  }, [allowed])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={20} className="animate-spin text-navy-light/60" />
      </div>
    )
  }

  if (user && !allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/6 mb-4">
          <Lock size={22} className="text-navy-light/60" />
        </div>
        <p className="text-base font-semibold text-navy font-display mb-1">Acceso restringido</p>
        <p className="text-sm text-navy-light/60 font-body max-w-sm">
          Esta sección es solo para el equipo de finanzas y administradores.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-navy px-6 py-5 shadow-card">
        <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">
          Solicitudes financieras
        </h1>
        <p className="mt-1 text-sm text-white/70 font-body">
          Becas y devoluciones solicitadas por los miembros
        </p>
      </div>

      <RequestBoard
        requests={requests}
        loading={loading}
        tabs={TABS}
        typeLabel={TYPE_LABEL}
        endpointBase="/api/finance/requests"
        assigneesUrl="/api/finance/requests/assignees"
        onUpdated={updated => setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)))}
        renderDetails={r => (
          <>
            {r.request_type === 'scholarship' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap size={13} className="text-navy-light/60" />
                  {r.study_group_name ?? 'Grupo por definir'}
                </span>
                {r.amount != null && r.amount > 0 && (
                  <span className="font-medium text-navy">{formatAmount(r.amount)} solicitados</span>
                )}
              </>
            )}
            {r.request_type === 'refund' && (
              <span className="inline-flex items-center gap-1.5">
                <CreditCard size={13} className="text-navy-light/60" />
                {r.payment_label ?? 'Pago no especificado'}
              </span>
            )}
          </>
        )}
        renderResolveHint={r => (
          <div className="rounded-xl bg-teal/10 border border-teal/25 px-3.5 py-2.5">
            {r.request_type === 'scholarship' ? (
              <p className="text-[13px] text-teal-deep font-body">
                Para hacerla efectiva, registrá la beca en{' '}
                <Link href="/finanzas/becas/nueva" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                  Finanzas → Becas <ExternalLink size={11} />
                </Link>
              </p>
            ) : (
              <p className="text-[13px] text-teal-deep font-body">
                Para procesarla, creá la devolución desde{' '}
                <Link href="/finanzas/pagos" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                  Finanzas → Pagos <ExternalLink size={11} />
                </Link>{' '}
                (acción Devolver sobre el pago original).
              </p>
            )}
          </div>
        )}
      />
    </div>
  )
}

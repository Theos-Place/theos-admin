'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/shared/Toast'
import { Check, X, Clock, Loader2 } from 'lucide-react'

type PositionRequest = {
  id: string
  committee: { name: string } | null
  title: string
  description: string | null
  functions: string | null
  profile: string | null
  study_requirement: string | null
  requester: { first_name: string; last_name: string } | null
  created_at: string
}

/** Solicitudes de puesto nuevo pendientes (Flujo 2). Staff/admin aprueba → crea el
 *  puesto en el catálogo, o rechaza. Se monta en /servidores/admin. */
export function PositionRequestsSection() {
  const toast = useToast()
  const [reqs, setReqs] = useState<PositionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/servers/position-requests?status=pending')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setReqs(Array.isArray(d) ? d : []))
      .catch(() => setReqs([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function resolve(id: string, action: 'approve' | 'reject') {
    if (busy) return
    setBusy(id)
    try {
      const res = await fetch(`/api/servers/position-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo procesar')
      toast(action === 'approve' ? 'Puesto creado y solicitud aprobada' : 'Solicitud rechazada', 'success')
      setReqs(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return null
  if (reqs.length === 0) return null

  return (
    <div id="solicitudes" className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={15} className="text-amber-600" />
        <p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">
          Solicitudes de puesto nuevo
        </p>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 font-body">{reqs.length} pendiente{reqs.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">
        {reqs.map(r => {
          const isOpen = open === r.id
          const hasDetail = !!(r.description || r.functions || r.profile)
          return (
            <div key={r.id} className="rounded-xl border border-[var(--outline-variant)]">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <button onClick={() => hasDetail && setOpen(isOpen ? null : r.id)} className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-navy font-body truncate">{r.title}</p>
                  <p className="text-[12px] text-navy-light/70 font-body truncate">
                    {r.committee?.name ?? '—'}{r.requester ? ` · pedido por ${r.requester.first_name} ${r.requester.last_name}` : ''}
                    {r.study_requirement ? ` · ${r.study_requirement}` : ''}
                  </p>
                </button>
                <button onClick={() => resolve(r.id, 'reject')} disabled={!!busy}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:text-coral hover:bg-coral/5 transition-colors disabled:opacity-50 font-body">
                  <X size={13} /> Rechazar
                </button>
                <button onClick={() => resolve(r.id, 'approve')} disabled={!!busy}
                  className="inline-flex items-center gap-1 rounded-full bg-coral px-3 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body">
                  {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprobar
                </button>
              </div>
              {isOpen && hasDetail && (
                <div className="px-4 pb-3 pt-1 space-y-2 border-t border-[var(--outline-variant)]">
                  {r.description && <div><p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">Descripción</p><p className="text-[13px] text-navy-light/80 font-body">{r.description}</p></div>}
                  {r.functions && <div><p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">Funciones</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line">{r.functions}</p></div>}
                  {r.profile && <div><p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">Perfil</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line">{r.profile}</p></div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

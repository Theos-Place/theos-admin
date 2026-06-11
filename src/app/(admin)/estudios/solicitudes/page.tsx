'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Inbox, Lock, ArrowRight, Loader2, MapPin, Clock, BookOpen } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/shared/Toast'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import type { StudyRequest, StudyRequestStatus, StudyRequestType } from '@/types/study'

const TABS: { key: StudyRequestType; label: string }[] = [
  { key: 'relocation', label: 'Reubicaciones' },
  { key: 'join_group', label: 'Unirse a grupo' },
  { key: 'new_group', label: 'Nuevo grupo en zona' },
]

const STATUS_FILTERS: { key: StudyRequestStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'open', label: 'Abiertas' },
  { key: 'in_review', label: 'En revisión' },
  { key: 'resolved', label: 'Resueltas' },
  { key: 'rejected', label: 'Rechazadas' },
]

const STATUS_BADGE: Record<StudyRequestStatus, { label: string; cls: string }> = {
  open:      { label: 'Abierta',     cls: 'bg-coral/10 text-coral' },
  in_review: { label: 'En revisión', cls: 'bg-[rgba(233,185,73,0.15)] text-[#A8821F]' },
  resolved:  { label: 'Resuelta',    cls: 'bg-success/12 text-success' },
  rejected:  { label: 'Rechazada',   cls: 'bg-surface-low text-navy-light/60' },
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '—'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SolicitudesPage() {
  const { user, loaded, hasRole } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<StudyRequestType>('relocation')
  const [statusFilter, setStatusFilter] = useState<StudyRequestStatus | 'all'>('all')
  const [requests, setRequests] = useState<StudyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionTarget, setActionTarget] = useState<{ req: StudyRequest; action: 'resolve' | 'reject' } | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Ver/tomar/resolver/rechazar: solo coordinadores y admin.
  const allowed = hasRole('coordinador_estudios', 'coordinador_dirigentes', 'admin')

  useEffect(() => {
    if (!allowed) return
    let alive = true
    fetch('/api/studies/requests')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) { setRequests(Array.isArray(d) ? d : []); setLoading(false) } })
      .catch(() => { if (alive) { setRequests([]); setLoading(false) } })
    return () => { alive = false }
  }, [allowed])

  const visible = useMemo(() =>
    requests
      .filter(r => r.request_type === tab)
      .filter(r => statusFilter === 'all' || r.status === statusFilter),
    [requests, tab, statusFilter])

  const countByTab = useMemo(() => {
    const m: Record<StudyRequestType, number> = { relocation: 0, join_group: 0, new_group: 0 }
    for (const r of requests) if (r.status === 'open' || r.status === 'in_review') m[r.request_type]++
    return m
  }, [requests])

  async function doAction(req: StudyRequest, action: 'take' | 'resolve' | 'reject', reviewNotes?: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/studies/requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, review_notes: reviewNotes || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo actualizar la solicitud')
      }
      const updated: StudyRequest = await res.json()
      setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)))
      toast(
        action === 'take' ? 'Solicitud tomada — quedó a tu nombre'
        : action === 'resolve' ? 'Solicitud marcada como resuelta'
        : 'Solicitud rechazada',
        'success',
      )
      setActionTarget(null)
      setNotes('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo actualizar la solicitud', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={20} className="animate-spin text-navy-light/40" />
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
          Esta sección es solo para coordinadores de estudios, coordinadores de dirigentes y administradores.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-navy px-6 py-5 shadow-card">
        <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">
          Solicitudes de estudios
        </h1>
        <p className="mt-1 text-sm text-white/50 font-body">
          Reubicaciones, ingresos a grupos y propuestas de grupos nuevos
        </p>
      </div>

      {/* Tabs por tipo */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-body transition-all',
              tab === t.key ? 'bg-navy text-white' : 'bg-surface-low text-navy-light/70 hover:text-navy',
            )}
          >
            {t.label}
            {countByTab[t.key] > 0 && (
              <span className={cn(
                'ml-2 inline-flex min-w-[20px] h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold font-display',
                tab === t.key ? 'bg-coral text-white' : 'bg-coral/10 text-coral',
              )}>
                {countByTab[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filtros por estado */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[12px] font-body border transition-all',
              statusFilter === f.key
                ? 'bg-navy text-white border-navy'
                : 'bg-transparent text-navy/60 border-outline hover:text-navy',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={18} className="animate-spin text-navy-light/40" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-card">
          <EmptyState
            icon={Inbox}
            title={statusFilter === 'all' ? 'No hay solicitudes en esta categoría' : 'Sin solicitudes con ese estado'}
            description="Las solicitudes que envíen los miembros van a aparecer acá."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(r => {
            const badge = STATUS_BADGE[r.status]
            return (
              <div key={r.id} className="rounded-2xl bg-surface-card shadow-card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[12px] font-display font-extrabold">
                      {initials(r.member_name)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/miembros/${r.member_id}`}
                        className="text-sm font-semibold text-navy font-body hover:text-coral transition-colors"
                      >
                        {r.member_name}
                      </Link>
                      <p className="text-[12px] text-navy-light/60 font-body">{formatDate(r.created_at)}</p>
                    </div>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold font-body shrink-0', badge.cls)}>
                    {badge.label}
                  </span>
                </div>

                {/* Detalle según tipo */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-navy-light/80 font-body">
                  {r.request_type === 'relocation' && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-medium text-navy">{r.current_group_name ?? 'Sin grupo actual'}</span>
                      <ArrowRight size={13} className="text-navy-light/50" />
                      <span className="font-medium text-navy">{r.existing_group_name ?? 'Grupo por definir'}</span>
                    </span>
                  )}
                  {r.request_type === 'join_group' && (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen size={13} className="text-navy-light/50" />
                        {r.plan_name ?? 'Plan por definir'}
                      </span>
                      {r.existing_group_name && <span className="font-medium text-navy">{r.existing_group_name}</span>}
                    </>
                  )}
                  {r.request_type === 'new_group' && (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen size={13} className="text-navy-light/50" />
                        {r.plan_name ?? 'Plan por definir'}
                      </span>
                      {r.proposed_location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={13} className="text-navy-light/50" />
                          {r.proposed_location}
                        </span>
                      )}
                      {r.proposed_schedule && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={13} className="text-navy-light/50" />
                          {r.proposed_schedule}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <p className="mt-2 text-sm text-navy-light/80 font-body leading-relaxed">
                  &ldquo;{r.reason}&rdquo;
                </p>

                {(r.status === 'in_review' || r.status === 'resolved' || r.status === 'rejected') && r.reviewed_by_name && (
                  <p className="mt-2 text-[12px] text-navy-light/60 font-body">
                    {r.status === 'in_review' ? 'En revisión por' : 'Revisada por'} {r.reviewed_by_name}
                    {r.review_notes ? ` — ${r.review_notes}` : ''}
                  </p>
                )}

                {/* Acciones */}
                {(r.status === 'open' || r.status === 'in_review') && (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {r.status === 'open' && (
                      <button
                        onClick={() => doAction(r, 'take')}
                        disabled={submitting}
                        className="rounded-full bg-navy px-4 py-1.5 text-[13px] text-white font-body hover:bg-navy-ink transition-colors disabled:opacity-60"
                      >
                        Tomar
                      </button>
                    )}
                    <button
                      onClick={() => { setActionTarget({ req: r, action: 'resolve' }); setNotes('') }}
                      disabled={submitting}
                      className="rounded-full bg-success/12 px-4 py-1.5 text-[13px] text-success font-body font-medium hover:bg-success/20 transition-colors disabled:opacity-60"
                    >
                      Resolver
                    </button>
                    <button
                      onClick={() => { setActionTarget({ req: r, action: 'reject' }); setNotes('') }}
                      disabled={submitting}
                      className="rounded-full bg-coral/10 px-4 py-1.5 text-[13px] text-coral font-body font-medium hover:bg-coral/20 transition-colors disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal resolver / rechazar */}
      {actionTarget && (
        <Modal onClose={() => setActionTarget(null)} titleId="action-modal-title">
          <div className="p-6">
            <h2 id="action-modal-title" className="text-lg font-semibold text-navy font-display mb-1">
              {actionTarget.action === 'resolve' ? 'Resolver solicitud' : 'Rechazar solicitud'}
            </h2>
            <p className="text-sm text-navy-light/60 font-body mb-4">
              {actionTarget.req.member_name} · {formatDate(actionTarget.req.created_at)}
            </p>
            <label htmlFor="review-notes" className="block text-[12px] font-medium text-navy-light/70 font-body mb-1.5">
              Notas {actionTarget.action === 'resolve' ? 'de resolución' : 'del rechazo'} (opcional)
            </label>
            <textarea
              id="review-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder={actionTarget.action === 'resolve'
                ? 'Ej: Se reubicó al grupo de Heredia, miércoles 7pm.'
                : 'Ej: No hay cupo disponible este trimestre.'}
              className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30 resize-none placeholder:text-navy-light/50"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setActionTarget(null)}
                className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => doAction(actionTarget.req, actionTarget.action, notes)}
                disabled={submitting}
                className={cn(
                  'rounded-full px-5 py-2 text-sm text-white font-body font-medium transition-colors disabled:opacity-60',
                  actionTarget.action === 'resolve' ? 'bg-success hover:bg-[#2f9c64]' : 'bg-coral hover:bg-coral-deep',
                )}
              >
                {submitting
                  ? 'Guardando…'
                  : actionTarget.action === 'resolve' ? 'Confirmar resolución' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

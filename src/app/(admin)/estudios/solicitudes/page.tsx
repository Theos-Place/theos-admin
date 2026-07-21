'use client'

import { useState, useEffect } from 'react'
import { Lock, Loader2, ArrowRight, MapPin, Clock, BookOpen, Plus, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { RequestBoard } from '@/components/shared/RequestBoard'
import { RequestTabs } from '@/components/shared/RequestTabs'
import { PrematrimonialQueue } from '@/components/studies/PrematrimonialQueue'
import { StudyRequestActions } from '@/components/studies/StudyRequestActions'
import { RelocationResolveGroupPicker } from '@/components/studies/RelocationResolveGroupPicker'
import type { StudyRequest } from '@/types/study'
import { getInitials } from '@/lib/format'

const TABS = [
  { key: 'relocation', label: 'Reubicaciones' },
  { key: 'study_interest', label: 'Intereses de estudio' },
]

const TYPE_LABEL: Record<string, string> = {
  relocation: 'Reubicación',
  study_interest: 'Interés en estudio',
}

function initials(name: string) {
  return getInitials(name) || '—'
}

function classLabel(v: string | null): string {
  if (!v) return ''
  return v === 'no_recuerda' ? 'No recuerda la clase' : `Quedó en la clase ${v}`
}

export default function SolicitudesPage() {
  const { user, loaded, hasRole } = useAuth()
  const [requests, setRequests] = useState<StudyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [createFor, setCreateFor] = useState<MemberHit | null>(null)
  const [section, setSection] = useState<'estudios' | 'prematrimonial'>('estudios')

  const allowed = hasRole('coordinador_estudios', 'coordinador_dirigentes', 'admin')

  useEffect(() => {
    if (!allowed) return
    let alive = true
    fetch('/api/studies/requests')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) { setRequests(Array.isArray(d) ? d : []); setLoading(false) } })
      .catch(() => { if (alive) { setRequests([]); setLoading(false) } })
    return () => { alive = false }
  }, [allowed, reloadKey])

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
          Esta sección es solo para coordinadores de estudios, coordinadores de dirigentes y administradores.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-navy px-6 py-5 shadow-card flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">
            Solicitudes de estudios
          </h1>
          <p className="mt-1 text-sm text-white/70 font-body">
            Reubicaciones e intereses de estudio de los miembros
          </p>
        </div>
        {section === 'estudios' && (
          <button
            onClick={() => { setCreateFor(null); setCreateOpen(true) }}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white font-body hover:bg-coral-deep transition-colors shrink-0"
          >
            <Plus size={14} />
            Crear solicitud
          </button>
        )}
      </div>

      {/* Tabs de sección: solicitudes de estudio (reubicaciones/intereses) y
          la cola de prematrimonial (flujo propio). */}
      <RequestTabs
        tabs={[{ key: 'estudios', label: 'Solicitudes de estudio' }, { key: 'prematrimonial', label: 'Prematrimonial' }]}
        active={section}
        onChange={k => setSection(k as 'estudios' | 'prematrimonial')}
      />

      {section === 'prematrimonial' ? <PrematrimonialQueue /> : (
      <RequestBoard
        requests={requests}
        loading={loading}
        tabs={TABS}
        typeLabel={TYPE_LABEL}
        endpointBase="/api/studies/requests"
        assigneesUrl="/api/studies/requests/assignees"
        onUpdated={updated => setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)))}
        renderDetails={r => (
          <>
            {r.request_type === 'relocation' && (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-navy">{r.current_group_name ?? 'Sin grupo actual'}</span>
                <ArrowRight size={13} className="text-navy-light/60" />
                <span className="font-medium text-navy">
                  {r.status === 'resolved' ? (r.resolved_group_name ?? '—') : (r.needed_study_code ?? r.existing_group_name ?? 'Grupo por definir')}
                </span>
              </span>
            )}
            {r.request_type === 'relocation' && r.last_class_attended && (
              <span>{classLabel(r.last_class_attended)}</span>
            )}
            {r.request_type === 'relocation' && r.last_leader_name && (
              <span>Último dirigente: {r.last_leader_name}</span>
            )}
            {r.request_type === 'relocation' && r.wants_folleto && (
              <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11px] font-semibold text-coral font-display">
                Ocupa folleto
              </span>
            )}
            {r.request_type !== 'relocation' && (
              <span className="inline-flex items-center gap-1.5">
                <BookOpen size={13} className="text-navy-light/60" />
                {r.plan_name ?? 'Plan por definir'}
              </span>
            )}
            {r.existing_group_name && r.request_type === 'study_interest' && (
              <span className="font-medium text-navy">{r.existing_group_name}</span>
            )}
            {r.proposed_location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-navy-light/60" />
                {r.proposed_location}
              </span>
            )}
            {r.proposed_schedule && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} className="text-navy-light/60" />
                {r.proposed_schedule}
              </span>
            )}
          </>
        )}
        renderResolveExtra={(r, onChange) => (
          r.request_type === 'relocation'
            ? <RelocationResolveGroupPicker request={r} onChange={onChange} />
            : null
        )}
      />
      )}

      {/* Modal "Crear solicitud" a nombre de otra persona */}
      {createOpen && (
        <Modal onClose={() => { setCreateOpen(false); setReloadKey(k => k + 1) }} titleId="create-request-title">
          <div className="p-6 space-y-4">
            <h2 id="create-request-title" className="text-lg font-semibold text-navy font-display">
              Crear solicitud a nombre de un miembro
            </h2>
            {!createFor ? (
              <>
                <p className="text-[13px] text-navy-light/60 font-body">
                  Buscá al miembro; los estudios disponibles se calculan según su elegibilidad.
                </p>
                <MemberCombobox autoFocus onSelect={setCreateFor} />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5 rounded-xl bg-surface-low px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
                    {initials(`${createFor.first_name} ${createFor.last_name}`)}
                  </span>
                  <span className="flex-1 truncate text-sm text-navy font-body font-medium">
                    {createFor.first_name} {createFor.last_name}
                  </span>
                  <button
                    onClick={() => setCreateFor(null)}
                    aria-label="Cambiar miembro"
                    className="rounded-lg p-1 text-navy-light/60 hover:text-coral transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-[12px] text-navy-light/60 font-body">
                  Elegí el tipo de solicitud — los estudios mostrados son los elegibles para este miembro:
                </p>
                <StudyRequestActions memberId={createFor.id} />
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

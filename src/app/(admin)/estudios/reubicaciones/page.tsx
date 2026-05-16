'use client'

import { useState } from 'react'
import { MOCK_RELOCATIONS, MOCK_GROUPS, type RelocationRequest } from '@/data/mock-studies'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { sedeLabel } from '@/data/mock-sedes'
import { cn } from '@/lib/utils'
import { X, CheckCircle } from 'lucide-react'

function SidePanel({
  request,
  onClose,
  onResolve,
}: {
  request: RelocationRequest
  onClose: () => void
  onResolve: (id: string) => void
}) {
  const [selectedGroup, setSelectedGroup] = useState('')
  const [resolved, setResolved] = useState(request.status === 'resolved')
  const fromGroup = MOCK_GROUPS.find(g => g.id === request.from_group_id)
  const compatibleGroups = MOCK_GROUPS.filter(g =>
    g.study_type_id === request.study_type &&
    g.id !== request.from_group_id &&
    g.status !== 'finished'
  )

  function handleConfirm() {
    if (!selectedGroup) return
    onResolve(request.id)
    setResolved(true)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col overflow-y-auto"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--outline-variant)' }}
        >
          <h2 className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Solicitud de reubicación
          </h2>
          <button onClick={onClose} className="text-navy-light/50 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Status */}
          {resolved ? (
            <div className="flex items-center gap-2 rounded-xl bg-teal-soft/20 px-4 py-3">
              <CheckCircle size={16} className="text-teal-deep" />
              <p className="text-sm text-teal-deep font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                Reubicación resuelta
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 px-4 py-2">
              <p className="text-[12px] text-amber-700" style={{ fontFamily: 'var(--font-body)' }}>
                Pendiente de resolución
              </p>
            </div>
          )}

          {/* Details */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                Miembro
              </p>
              <p className="text-sm text-navy font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                {request.member_name}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                Estudio
              </p>
              <StudyTypeBadge code={request.study_type} size="sm" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                Grupo actual
              </p>
              {fromGroup ? (
                <p className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                  {fromGroup.study_type_id} — {sedeLabel(fromGroup.zone)} · {fromGroup.schedule_days.join('/')} {fromGroup.schedule_time}
                </p>
              ) : (
                <p className="text-sm text-navy-light/40">—</p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                Motivo de reubicación
              </p>
              <p className="text-sm text-navy-light/70 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                {request.reason}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                Solicitado el
              </p>
              <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                {request.requested_at}
              </p>
            </div>
          </div>

          {/* Historial placeholder */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Historial en {request.study_type}
            </p>
            <div className="rounded-xl bg-surface-low px-4 py-3 space-y-1">
              <p className="text-[12px] text-navy-light/50 italic" style={{ fontFamily: 'var(--font-body)' }}>
                Inscrito en este estudio desde la semana 1.
              </p>
              <p className="text-[12px] text-navy-light/50 italic" style={{ fontFamily: 'var(--font-body)' }}>
                Asistencia registrada antes de la solicitud de reubicación.
              </p>
              <p className="text-[12px] text-navy-light/50 italic" style={{ fontFamily: 'var(--font-body)' }}>
                Sin incidencias previas en otros grupos.
              </p>
            </div>
          </div>

          {/* Destination group selector */}
          {!resolved && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Grupo destino
              </p>
              {compatibleGroups.length === 0 ? (
                <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                  No hay grupos disponibles con este tipo de estudio.
                </p>
              ) : (
                <div className="space-y-2">
                  {compatibleGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroup(g.id)}
                      className={cn(
                        'w-full text-left rounded-xl px-3 py-2.5 border transition-all',
                        selectedGroup === g.id ? 'border-coral bg-coral/5' : 'hover:bg-surface-low'
                      )}
                      style={{ borderColor: selectedGroup === g.id ? undefined : 'var(--outline-variant)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-navy font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                            {sedeLabel(g.zone)} · {g.schedule_days.join('/')} {g.schedule_time}
                          </p>
                          <p className="text-[11px] text-navy-light/50">
                            Dirigente: {g.leader_name ?? 'Por asignar'} · Cap: {g.max_capacity}
                          </p>
                        </div>
                        <GroupStatusBadge status={g.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!resolved && (
          <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
            <button
              onClick={handleConfirm}
              disabled={!selectedGroup}
              className="w-full rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Confirmar reubicación
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function ReubicacionesPage() {
  const [requests, setRequests] = useState(MOCK_RELOCATIONS)
  const [selectedRequest, setSelectedRequest] = useState<RelocationRequest | null>(null)

  function handleResolve(id: string) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' as const } : r))
  }

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status === 'resolved')

  return (
    <div className="space-y-5">
      {selectedRequest && (
        <SidePanel
          request={requests.find(r => r.id === selectedRequest.id) ?? selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onResolve={handleResolve}
        />
      )}

      {/* Header */}
      <div>
        <h1
          className="text-2xl text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          Reubicaciones
        </h1>
        <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          {pending.length} solicitudes pendientes · {resolved.length} resueltas
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Miembro', 'Estudio', 'Motivo', 'Fecha', 'Estado'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className="hover:bg-surface-low cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid var(--outline-variant)' }}
              >
                <td className="px-4 py-3 text-sm text-navy font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                  {req.member_name}
                </td>
                <td className="px-4 py-3">
                  <StudyTypeBadge code={req.study_type} size="sm" />
                </td>
                <td className="px-4 py-3 text-sm text-navy-light/70 max-w-[200px]" style={{ fontFamily: 'var(--font-body)' }}>
                  <span className="truncate block" title={req.reason}>
                    {req.reason.length > 40 ? req.reason.slice(0, 40) + '…' : req.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  {req.requested_at}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'rounded-md px-2 py-0.5 text-[10px] font-medium',
                    req.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-teal-soft/30 text-teal-deep'
                  )}>
                    {req.status === 'pending' ? 'Pendiente' : 'Resuelta'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              Sin solicitudes de reubicación.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

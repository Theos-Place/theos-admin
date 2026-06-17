'use client'

import { useState } from 'react'
import { QrCode, Trash2 } from 'lucide-react'
import { CapacityBar } from '@/components/events/CapacityBar'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import { Modal } from '@/components/shared/Modal'
import { useClientPagination } from '@/hooks/useClientPagination'
import { usePermissions } from '@/hooks/usePermissions'
import { TOAST_MS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { MockEvent, EventCheckin } from '@/data/event-config'
import { getInitials } from '@/lib/format'

type Event = MockEvent

const AVATAR_COLORS: Record<string, string> = {
  A: 'bg-coral', B: 'bg-teal-deep', C: 'bg-navy', D: 'bg-purple-700', E: 'bg-amber-500',
  F: 'bg-coral', G: 'bg-teal-deep', H: 'bg-navy', I: 'bg-purple-700', J: 'bg-amber-500',
  K: 'bg-coral', L: 'bg-teal-deep', M: 'bg-navy', N: 'bg-purple-700', O: 'bg-amber-500',
  P: 'bg-coral', Q: 'bg-teal-deep', R: 'bg-navy', S: 'bg-purple-700', T: 'bg-amber-500',
  U: 'bg-coral', V: 'bg-teal-deep', W: 'bg-navy', X: 'bg-purple-700', Y: 'bg-amber-500', Z: 'bg-coral',
}

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charAt(0).toUpperCase()] ?? 'bg-navy'
}

type Props = {
  event: Event
  eventId: string
  checkinCount: number
  onChanged?: () => void
}

export function EventCheckinTab({ event, eventId, checkinCount, onChanged }: Props) {
  const page = useClientPagination(event.checkins, 20)
  const { can } = usePermissions()
  const canUndo = can('eventos', 'edit') // encargado_eventos, direccion, admin
  const [toUndo, setToUndo] = useState<EventCheckin | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function confirmUndo() {
    if (!toUndo || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/events/${eventId}/checkins?checkinId=${encodeURIComponent(toUndo.id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo deshacer')
      setToUndo(null)
      onChanged?.()
      setToast('Check-in deshecho')
      setTimeout(() => setToast(null), TOAST_MS)
    } catch {
      setToast('Error al deshacer el check-in')
      setTimeout(() => setToast(null), TOAST_MS)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {event.sub_events.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {event.sub_events.map(se => {
            const seCheckins = event.checkins.filter(c => c.sub_event_id === se.id).length
            return (
              <div key={se.id} className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
                <p className="text-[10px] tracking-widests uppercase text-navy-light/60 font-display">{se.name}</p>
                <p className="mt-1 text-3xl font-extrabold text-navy tabular-nums font-display">{seCheckins}</p>
                <CapacityBar current={seCheckins} max={se.max_capacity} />
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-navy-light/60 font-body">
          {checkinCount} check-ins registrados
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        <div className="px-4 py-3 border-b border-b-[var(--outline-variant)]">
          <p className="text-[10px] tracking-widests uppercase text-navy-light/60 font-display">Check-ins registrados</p>
        </div>
        {event.checkins.length === 0 ? (
          <EmptyState icon={QrCode} title="Aún no hay check-ins registrados" />
        ) : (
          <div>
            {page.visible.map((ci, idx) => (
              <div
                key={ci.id}
                className={cn('flex items-center gap-3 px-4 py-3', idx % 2 === 1 ? 'bg-surface-low/40' : '')}
              >
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(ci.member_name))}>
                  {getInitials(ci.member_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy truncate font-body">{ci.member_name}</p>
                  <p className="text-[11px] text-navy-light/60 font-body">
                    {new Date(ci.checked_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                    {ci.sub_event_id && ` · ${ci.sub_event_id}`}
                  </p>
                </div>
                <span className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-medium',
                  ci.attendance_type === 'server' ? 'bg-coral/10 text-coral' : 'bg-teal-soft/30 text-teal-deep'
                )}>
                  {ci.attendance_type === 'server' ? 'Servidor' : 'Participante'}
                </span>
                {canUndo && (
                  <button
                    onClick={() => setToUndo(ci)}
                    aria-label={`Deshacer check-in de ${ci.member_name}`}
                    title="Deshacer check-in"
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-navy-light/50 hover:text-coral hover:bg-coral/5 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <LoadMoreFooter
              shown={page.shown}
              total={page.total}
              hasMore={page.hasMore}
              loading={false}
              onLoadMore={page.loadMore}
              noun="check-ins"
              increment={20}
            />
          </div>
        )}
      </div>

      {/* Confirmación de deshacer check-in */}
      {toUndo && (
        <Modal onClose={() => !busy && setToUndo(null)} titleId="undo-checkin-title" width={400}>
          <div className="p-5 space-y-4">
            <h2 id="undo-checkin-title" className="text-base font-display font-extrabold text-navy">
              ¿Deshacer el check-in de {toUndo.member_name}?
            </h2>
            <p className="text-sm text-navy-light/70 font-body">
              Esto quita el registro de asistencia a este evento. Se puede volver a hacer check-in.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setToUndo(null)}
                disabled={busy}
                className="flex-1 rounded-full border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={confirmUndo}
                disabled={busy}
                className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body disabled:opacity-50"
              >
                {busy ? 'Deshaciendo…' : 'Deshacer check-in'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-navy px-4 py-2 text-sm text-white shadow-[var(--shadow-lg)] font-body">
          {toast}
        </div>
      )}
    </div>
  )
}

import { Check, Clock, X as XIcon, UserPlus, Search, Send } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { RowActionsMenu } from '@/components/shared/RowActionsMenu'
import type { Member } from '@/types/member'
import { cn } from '@/lib/utils'

export type VolunteerBooking = {
  id: string
  member_id: string
  member_name: string
  member_initials: string
  role: string
  status: 'confirmed' | 'pending' | 'declined'
  is_recurring: boolean
}

const SERVER_ROLES = [
  'Anfitrión', 'Sonidista', 'Proyección', 'Coordinador de Kids',
  'Coordinador de Teens', 'Logística', 'Seguridad', 'Otro',
]

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
  allBookings: VolunteerBooking[]
  groupedBookings: Record<string, VolunteerBooking[]>
  confirmedCount: number
  pendingCount: number
  declinedCount: number
  isRecurring: boolean
  onRemoveBooking: (id: string) => void
  showAssignModal: boolean
  onShowAssignModal: () => void
  modalStep: 1 | 2
  setModalStep: (step: 1 | 2) => void
  searchQuery: string
  onSearchQueryChange: (val: string) => void
  filterCommittee: boolean
  onFilterCommitteeChange: (val: boolean) => void
  filteredMembers: Member[]
  selectedMemberId: string | null
  onSelectMemberId: (id: string) => void
  selectedMember: Member | null | undefined
  assignRole: string
  onAssignRoleChange: (val: string) => void
  customRole: string
  onCustomRoleChange: (val: string) => void
  onResetModal: () => void
  onConfirmAssignment: () => void
  serverToast: string | null
  /** El evento no tiene comité organizador → aviso suave (sin bloquear). */
  noCommittee?: boolean
}

export function EventServersTab({
  groupedBookings,
  confirmedCount,
  pendingCount,
  declinedCount,
  isRecurring,
  onRemoveBooking,
  showAssignModal,
  onShowAssignModal,
  modalStep,
  setModalStep,
  searchQuery,
  onSearchQueryChange,
  filterCommittee,
  onFilterCommitteeChange,
  filteredMembers,
  selectedMemberId,
  onSelectMemberId,
  selectedMember,
  assignRole,
  onAssignRoleChange,
  customRole,
  onCustomRoleChange,
  onResetModal,
  onConfirmAssignment,
  serverToast,
  noCommittee,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft/30 px-3 py-1.5 text-[12px] text-teal-deep font-body">
            <Check size={12} strokeWidth={2.5} /> {confirmedCount} confirmados
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[12px] text-amber-700 font-body">
            <Clock size={12} strokeWidth={2} className="animate-pulse" /> {pendingCount} pendientes
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3 py-1.5 text-[12px] text-navy/70 font-body">
            <XIcon size={12} strokeWidth={2} /> {declinedCount} declinaron
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Los volunteers viven en el evento padre: en un recurrente SIEMPRE
              aplican a toda la serie. El toggle anterior no controlaba nada. */}
          {isRecurring && (
            <span className="text-[12px] text-navy-light/60 font-body">
              Los servidores asignados aplican a todas las fechas de la serie.
            </span>
          )}
          <button
            onClick={() => { onShowAssignModal(); setModalStep(1) }}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors font-body"
          >
            <UserPlus size={13} /> Asignar servidor
          </button>
        </div>
      </div>

      {/* Bookings grouped by role */}
      {Object.keys(groupedBookings).length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
          <EmptyState icon={UserPlus} title="No hay servidores asignados aún" />
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedBookings).map(([role, bookings]) => (
            <div key={role} className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-[10px] tracking-widest uppercase text-navy-light/60 mb-3 font-display">{role}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {bookings.map(b => (
                  <div key={b.id} className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 bg-surface-low">
                    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', avatarColor(b.member_name))}>
                      {b.member_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate font-body">{b.member_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                          'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                          b.status === 'confirmed' ? 'bg-teal-soft/30 text-teal-deep' :
                          b.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-navy/10 text-navy/70'
                        )}>
                          {b.status === 'confirmed' ? '✓ Confirmado' : b.status === 'pending' ? '⏳ Pendiente' : '✗ Declinó'}
                        </span>
                        {/* Badge "Serie" eliminado: is_recurring era estado local
                            decorativo, no un dato persistido. */}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <RowActionsMenu
                        label={`Acciones de ${b.member_name}`}
                        width={160}
                        triggerClassName="hover:bg-surface-card"
                        actions={[
                          // Para cambiar de rol: Quitar y volver a asignar (no hay edición in-place).
                          { label: 'Quitar', onClick: () => onRemoveBooking(b.id), danger: true },
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <Modal onClose={onResetModal} titleId="asignar-servidor-titulo" width={448}>
            {/* Modal header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-b-[var(--outline-variant)]">
              <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white', modalStep === 1 ? 'bg-coral' : 'bg-teal-deep')}>
                {modalStep}
              </span>
              <span id="asignar-servidor-titulo" className="text-sm font-semibold text-navy font-display">
                {modalStep === 1 ? 'Buscar miembro' : 'Definir rol'}
              </span>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {noCommittee && modalStep === 1 && (
                <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] text-amber-700 font-body">
                  Este evento no tiene comité organizador asignado. Asigná uno para habilitar la validación de servidores.
                </div>
              )}
              {/* Step 1 — search */}
              {modalStep === 1 && (
                <>
                  <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 focus-within:ring-1 focus-within:ring-coral/30">
                    <Search size={14} className="text-navy-light/60 shrink-0" />
                    <input
                      type="search"
                      autoFocus
                      placeholder="Nombre o cédula..."
                      value={searchQuery}
                      onChange={e => onSearchQueryChange(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-navy outline-none placeholder-navy-light/50 font-body"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-coral h-4 w-4"
                      checked={filterCommittee}
                      onChange={e => onFilterCommitteeChange(e.target.checked)}
                    />
                    <span className="text-[12px] text-navy-light/60 font-body">
                      Solo miembros del comité organizador
                    </span>
                  </label>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {filteredMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onSelectMemberId(m.id)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                          selectedMemberId === m.id
                            ? 'bg-coral/10 ring-1 ring-coral/30'
                            : 'hover:bg-surface-low'
                        )}
                      >
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(m.first_name))}>
                          {(m.first_name[0] + m.last_name[0]).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-navy truncate font-body">
                            {m.first_name} {m.last_name}
                          </p>
                          <p className="text-[11px] text-navy-light/60 truncate font-mono">
                            {m.cedula ?? 'Sin cédula'}
                            {m.service_history.filter(s => s.status === 'activo').map(s => ` · ${s.committee}`).join('')}
                          </p>
                        </div>
                        {selectedMemberId === m.id && <Check size={14} className="text-coral shrink-0" />}
                      </button>
                    ))}
                    {filteredMembers.length === 0 && (
                      <p className="text-sm text-navy-light/60 text-center py-4 font-body">Sin resultados</p>
                    )}
                  </div>
                </>
              )}

              {/* Step 2 — role & config */}
              {modalStep === 2 && selectedMember && (
                <>
                  <div className="flex items-center gap-3 rounded-xl bg-teal-soft/10 px-3 py-2.5">
                    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', avatarColor(selectedMember.first_name))}>
                      {(selectedMember.first_name[0] + selectedMember.last_name[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy font-body">
                        {selectedMember.first_name} {selectedMember.last_name}
                      </p>
                      <p className="text-[11px] text-navy-light/60 font-mono">
                        {selectedMember.cedula ?? 'Sin cédula'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display">
                      Rol en este evento
                    </label>
                    <select
                      className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                      value={assignRole}
                      onChange={e => onAssignRoleChange(e.target.value)}
                    >
                      <option value="">Seleccionar rol...</option>
                      {SERVER_ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {assignRole === 'Otro' && (
                      <input
                        type="text"
                        autoFocus
                        placeholder="Especificá el rol..."
                        value={customRole}
                        onChange={e => onCustomRoleChange(e.target.value)}
                        className="mt-2 w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                      />
                    )}
                  </div>

                  {isRecurring && (
                    <p className="rounded-xl bg-surface-low px-3 py-2.5 text-[12px] text-navy-light/60 font-body">
                      Este evento es recurrente: la persona quedará asignada a todas las fechas de la serie.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-t-[var(--outline-variant)]">
              <button
                onClick={() => modalStep === 1 ? onResetModal() : setModalStep(1)}
                className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                {modalStep === 1 ? 'Cancelar' : '← Atrás'}
              </button>
              {modalStep === 1 ? (
                <button
                  onClick={() => { if (selectedMemberId) setModalStep(2) }}
                  disabled={!selectedMemberId}
                  className="rounded-xl bg-navy px-4 py-2 text-sm text-white hover:bg-navy/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body"
                >
                  Continuar →
                </button>
              ) : (
                <button
                  onClick={onConfirmAssignment}
                  disabled={!assignRole || (assignRole === 'Otro' && !customRole.trim())}
                  className="rounded-xl bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body"
                >
                  Asignar servidor
                </button>
              )}
            </div>
        </Modal>
      )}

      {/* Toast */}
      {serverToast && (
        <div
          className="fixed bottom-6 right-6 flex items-center gap-3 rounded-2xl bg-navy px-5 py-3.5 text-white z-50 shadow-[var(--shadow-lg)]"
        >
          <Send size={14} className="text-teal-soft shrink-0" />
          <span className="text-sm font-body">{serverToast}</span>
        </div>
      )}
    </div>
  )
}

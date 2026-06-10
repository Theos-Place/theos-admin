import { Check, Clock, X as XIcon, UserPlus, Search, Link2, MoreVertical, Send } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { mockMembers } from '@/data/mock-members'
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
  recurringGlobal: boolean
  onRecurringGlobalToggle: () => void
  openServerMenu: string | null
  onServerMenuToggle: (id: string) => void
  onRemoveBooking: (id: string) => void
  showAssignModal: boolean
  onShowAssignModal: () => void
  modalStep: 1 | 2
  setModalStep: (step: 1 | 2) => void
  searchQuery: string
  onSearchQueryChange: (val: string) => void
  filterCommittee: boolean
  onFilterCommitteeChange: (val: boolean) => void
  filteredMembers: typeof mockMembers
  selectedMemberId: string | null
  onSelectMemberId: (id: string) => void
  selectedMember: (typeof mockMembers)[number] | null | undefined
  assignRole: string
  onAssignRoleChange: (val: string) => void
  customRole: string
  onCustomRoleChange: (val: string) => void
  assignRecurring: boolean
  onAssignRecurringToggle: () => void
  onResetModal: () => void
  onConfirmAssignment: () => void
  serverToast: string | null
}

export function EventServersTab({
  allBookings,
  groupedBookings,
  confirmedCount,
  pendingCount,
  declinedCount,
  isRecurring,
  recurringGlobal,
  onRecurringGlobalToggle,
  openServerMenu,
  onServerMenuToggle,
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
  assignRecurring,
  onAssignRecurringToggle,
  onResetModal,
  onConfirmAssignment,
  serverToast,
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3 py-1.5 text-[12px] text-navy/50 font-body">
            <XIcon size={12} strokeWidth={2} /> {declinedCount} declinaron
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isRecurring && (
            <label className="flex items-center gap-2 cursor-pointer" title="Los servidores asignados se repetirán automáticamente en cada fecha de la serie">
              <div
                onClick={onRecurringGlobalToggle}
                className={cn('relative h-5 w-9 rounded-full transition-colors cursor-pointer', recurringGlobal ? 'bg-coral' : 'bg-navy-light/20')}
              >
                <div className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', recurringGlobal ? 'translate-x-4' : 'translate-x-0')} />
              </div>
              <span className="text-[12px] text-navy-light/60 font-body">Aplicar a toda la serie</span>
            </label>
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
              <p className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-3 font-display">{role}</p>
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
                          'bg-navy/10 text-navy/50'
                        )}>
                          {b.status === 'confirmed' ? '✓ Confirmado' : b.status === 'pending' ? '⏳ Pendiente' : '✗ Declinó'}
                        </span>
                        {b.is_recurring && (
                          <span className="text-[10px] text-navy-light/40 font-body">
                            <Link2 size={10} className="inline" /> Serie
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        onClick={() => onServerMenuToggle(b.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/60 hover:bg-surface-card hover:text-navy transition-all"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {openServerMenu === b.id && (
                        <div
                          className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden w-36 z-20 bg-surface-card shadow-[var(--shadow-lg)] border border-[var(--outline-variant)]"
                        >
                          <button
                            onClick={() => onServerMenuToggle(b.id)}
                            className="w-full text-left px-3 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
                          >
                            Cambiar rol
                          </button>
                          <button
                            onClick={() => onRemoveBooking(b.id)}
                            className="w-full text-left px-3 py-2 text-[12px] text-coral hover:bg-coral/5 transition-colors font-body"
                          >
                            Quitar
                          </button>
                        </div>
                      )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={onResetModal} />
          <div
            className="relative rounded-2xl w-full max-w-md mx-4 overflow-hidden bg-surface-card shadow-[var(--shadow-lg)]"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-b-[var(--outline-variant)]">
              <div className="flex items-center gap-3">
                <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white', modalStep === 1 ? 'bg-coral' : 'bg-teal-deep')}>
                  {modalStep}
                </span>
                <span className="text-sm font-semibold text-navy font-display">
                  {modalStep === 1 ? 'Buscar miembro' : 'Definir rol'}
                </span>
              </div>
              <button onClick={onResetModal} className="text-navy-light/40 hover:text-navy transition-colors">
                <XIcon size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Step 1 — search */}
              {modalStep === 1 && (
                <>
                  <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 focus-within:ring-1 focus-within:ring-coral/30">
                    <Search size={14} className="text-navy-light/40 shrink-0" />
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
                          <p className="text-[11px] text-navy-light/40 truncate font-mono">
                            {m.cedula ?? 'Sin cédula'}
                            {m.service_history.filter(s => s.status === 'activo').map(s => ` · ${s.committee}`).join('')}
                          </p>
                        </div>
                        {selectedMemberId === m.id && <Check size={14} className="text-coral shrink-0" />}
                      </button>
                    ))}
                    {filteredMembers.length === 0 && (
                      <p className="text-sm text-navy-light/40 text-center py-4 font-body">Sin resultados</p>
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
                      <p className="text-[11px] text-navy-light/50 font-mono">
                        {selectedMember.cedula ?? 'Sin cédula'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">
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
                    <label className="flex items-start gap-3 cursor-pointer rounded-xl bg-surface-low px-3 py-2.5">
                      <div
                        onClick={onAssignRecurringToggle}
                        className={cn('relative h-5 w-9 rounded-full transition-colors cursor-pointer mt-0.5 shrink-0', assignRecurring ? 'bg-coral' : 'bg-navy-light/20')}
                      >
                        <div className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', assignRecurring ? 'translate-x-4' : 'translate-x-0')} />
                      </div>
                      <div>
                        <p className="text-sm text-navy font-body">Booking recurrente</p>
                        {assignRecurring && (
                          <p className="text-[11px] text-navy-light/50 mt-0.5 font-body">
                            Esta persona quedará asignada a todas las instancias futuras de esta serie
                          </p>
                        )}
                      </div>
                    </label>
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
          </div>
        </div>
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

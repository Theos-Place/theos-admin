'use client'

import { X, Search, Plus } from 'lucide-react'
import { type CommitteeServer } from '@/data/mock-servers'
import { SERVICE_POSITIONS } from '@/data/mock-committees'
import { cn } from '@/lib/utils'

type DisconnectReason = 'renuncia' | 'cambio' | 'fin-periodo' | 'otro'

const DISCONNECT_REASONS: { value: DisconnectReason; label: string }[] = [
  { value: 'renuncia',    label: 'Renuncia voluntaria' },
  { value: 'cambio',      label: 'Cambio de comité' },
  { value: 'fin-periodo', label: 'Fin de período' },
  { value: 'otro',        label: 'Otro' },
]

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

// ── Disconnect modal ─────────────────────────────────────────────────────────

type DisconnectModalProps = {
  target: CommitteeServer
  reason: DisconnectReason
  otherReason: string
  date: string
  onReasonChange: (value: DisconnectReason) => void
  onOtherReasonChange: (value: string) => void
  onDateChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function DisconnectModal({
  target,
  reason,
  otherReason,
  date,
  onReasonChange,
  onOtherReasonChange,
  onDateChange,
  onConfirm,
  onCancel,
}: DisconnectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
              Desvincular servidor
            </p>
            <p className="text-sm text-navy-light/60 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              {target.name}
            </p>
          </div>
          <button onClick={onCancel} className="text-navy-light/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Motivo
            </label>
            <select
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
              style={{ fontFamily: 'var(--font-body)' }}
              value={reason}
              onChange={e => onReasonChange(e.target.value as DisconnectReason)}
            >
              {DISCONNECT_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {reason === 'otro' && (
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Especificar motivo
              </label>
              <input
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Describe el motivo..."
                value={otherReason}
                onChange={e => onOtherReasonChange(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Fecha efectiva de salida
            </label>
            <input
              type="date"
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
              style={{ fontFamily: 'var(--font-body)' }}
              value={date}
              onChange={e => onDateChange(e.target.value)}
            />
          </div>
        </div>

        <div
          className="rounded-xl px-3 py-2.5 text-[12px] text-amber-700 bg-amber-50"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Esta acción moverá al servidor al historial del comité.
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Confirmar salida
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit committee modal ─────────────────────────────────────────────────────

export type CommitteeFormState = {
  name: string
  area: string
  area_code: string
  ideal_capacity: string
}

type EditCommitteeModalProps = {
  form: CommitteeFormState
  onFormChange: (updater: (prev: CommitteeFormState) => CommitteeFormState) => void
  onSave: () => void
  onCancel: () => void
}

export function EditCommitteeModal({ form, onFormChange, onSave, onCancel }: EditCommitteeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Editar comité</p>
          <button onClick={onCancel} className="text-navy-light/40 hover:text-navy"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Nombre</label>
            <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.name} onChange={e => onFormChange(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Área</label>
            <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.area} onChange={e => onFormChange(p => ({ ...p, area: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Código de área</label>
            <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.area_code} onChange={e => onFormChange(p => ({ ...p, area_code: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Capacidad ideal</label>
            <input type="number" min="1" max="100" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.ideal_capacity} onChange={e => onFormChange(p => ({ ...p, ideal_capacity: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>Cancelar</button>
          <button onClick={onSave} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors" style={{ fontFamily: 'var(--font-body)' }}>Guardar cambios</button>
        </div>
      </div>
    </div>
  )
}

// ── Add server modal ─────────────────────────────────────────────────────────

type Candidate = {
  id: string
  first_name: string
  last_name: string
  email: string
}

type AddServerModalProps = {
  serverSearch: string
  onServerSearchChange: (value: string) => void
  filteredCandidates: Candidate[]
  onAddServer: (memberId: string) => void
  onClose: () => void
}

export function AddServerModal({
  serverSearch,
  onServerSearchChange,
  filteredCandidates,
  onAddServer,
  onClose,
}: AddServerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Añadir servidor</p>
          <button onClick={onClose} className="text-navy-light/40 hover:text-navy"><X size={18} /></button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
          <input
            className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="Buscar por nombre..."
            value={serverSearch}
            onChange={e => onServerSearchChange(e.target.value)}
            autoFocus
          />
        </div>
        {filteredCandidates.length > 0 ? (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredCandidates.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => onAddServer(m.id)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-low transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{m.first_name[0]}{m.last_name[0]}</span>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{m.first_name} {m.last_name}</p>
                  <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>{m.email}</p>
                </div>
                <Plus size={14} className="ml-auto text-coral shrink-0" />
              </button>
            ))}
          </div>
        ) : serverSearch.trim() ? (
          <p className="text-center text-sm text-navy-light/40 py-4" style={{ fontFamily: 'var(--font-body)' }}>No se encontraron miembros.</p>
        ) : (
          <p className="text-center text-[12px] text-navy-light/30 py-4" style={{ fontFamily: 'var(--font-body)' }}>Escribí un nombre para buscar</p>
        )}
      </div>
    </div>
  )
}

// ── Change position modal ────────────────────────────────────────────────────

type ChangePositionModalProps = {
  target: CommitteeServer
  newPosition: string
  onPositionChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ChangePositionModal({
  target,
  newPosition,
  onPositionChange,
  onConfirm,
  onCancel,
}: ChangePositionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Cambiar puesto</p>
            <p className="text-sm text-navy-light/60 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>{target.name}</p>
          </div>
          <button onClick={onCancel} className="text-navy-light/40 hover:text-navy"><X size={18} /></button>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Nuevo puesto</label>
          <select
            className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
            style={{ fontFamily: 'var(--font-body)' }}
            value={newPosition}
            onChange={e => onPositionChange(e.target.value)}
          >
            <option value="">Seleccionar puesto...</option>
            {SERVICE_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>Cancelar</button>
          <button onClick={onConfirm} disabled={!newPosition} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep disabled:opacity-40 transition-colors" style={{ fontFamily: 'var(--font-body)' }}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}

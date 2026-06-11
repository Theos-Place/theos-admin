'use client'

import { Search, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import type { CommitteeServer, CommitteePosition } from '@/types/server'

type DisconnectReason = 'renuncia' | 'cambio' | 'fin-periodo' | 'otro'

const DISCONNECT_REASONS: { value: DisconnectReason; label: string }[] = [
  { value: 'renuncia',    label: 'Renuncia voluntaria' },
  { value: 'cambio',      label: 'Cambio de comité' },
  { value: 'fin-periodo', label: 'Fin de período' },
  { value: 'otro',        label: 'Otro' },
]

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

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
    <Modal onClose={onCancel} titleId="desvincular-servidor" width={384}>
      <div className="p-6 space-y-4">
        <div>
          <p id="desvincular-servidor" className="text-base font-bold text-navy font-display">
            Desvincular servidor
          </p>
          <p className="text-sm text-navy-light/60 mt-0.5 font-body">
            {target.name}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">
              Motivo
            </label>
            <select
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
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
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">
                Especificar motivo
              </label>
              <input
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                placeholder="Describe el motivo..."
                value={otherReason}
                onChange={e => onOtherReasonChange(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40 font-display">
              Fecha efectiva de salida
            </label>
            <input
              type="date"
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              value={date}
              onChange={e => onDateChange(e.target.value)}
            />
          </div>
        </div>

        <div
          className="rounded-xl px-3 py-2.5 text-[12px] text-amber-700 bg-amber-50 font-body"
        >
          Esta acción moverá al servidor al historial del comité.
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            Confirmar salida
          </button>
        </div>
      </div>
    </Modal>
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
    <Modal onClose={onCancel} titleId="editar-comite" width={448}>
      <div className="p-6 space-y-4">
        <p id="editar-comite" className="text-base font-bold text-navy font-display">Editar comité</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">Nombre</label>
            <input className={inputCls} value={form.name} onChange={e => onFormChange(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">Área</label>
            <input className={inputCls} value={form.area} onChange={e => onFormChange(p => ({ ...p, area: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">Código de área</label>
            <input className={inputCls} value={form.area_code} onChange={e => onFormChange(p => ({ ...p, area_code: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">Capacidad ideal</label>
            <input type="number" min="1" max="100" className={inputCls} value={form.ideal_capacity} onChange={e => onFormChange(p => ({ ...p, ideal_capacity: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
          <button onClick={onSave} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Guardar cambios</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add server modal ─────────────────────────────────────────────────────────

type Candidate = {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

type AddServerModalProps = {
  serverSearch: string
  onServerSearchChange: (value: string) => void
  filteredCandidates: Candidate[]
  positions: CommitteePosition[]
  positionId: string
  onPositionChange: (value: string) => void
  onAddServer: (memberId: string) => void
  onClose: () => void
}

export function AddServerModal({
  serverSearch,
  onServerSearchChange,
  filteredCandidates,
  positions,
  positionId,
  onPositionChange,
  onAddServer,
  onClose,
}: AddServerModalProps) {
  return (
    <Modal onClose={onClose} titleId="anadir-servidor" width={448}>
      <div className="p-6 space-y-4">
        <p id="anadir-servidor" className="text-base font-bold text-navy font-display">Añadir servidor</p>
        <div className="space-y-1">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">Puesto</label>
          <select
            className={inputCls}
            value={positionId}
            onChange={e => onPositionChange(e.target.value)}
          >
            <option value="">Seleccionar puesto...</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className={positionId ? 'relative' : 'relative opacity-50 pointer-events-none'}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
          <input
            className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            placeholder="Buscar por nombre..."
            aria-label="Buscar por nombre"
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
                  <span className="text-[10px] font-bold text-white font-display">{m.first_name[0]}{m.last_name[0]}</span>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-navy font-body">{m.first_name} {m.last_name}</p>
                  <p className="text-[11px] text-navy-light/40 font-body">{m.email}</p>
                </div>
                <Plus size={14} className="ml-auto text-coral shrink-0" />
              </button>
            ))}
          </div>
        ) : serverSearch.trim() ? (
          <p className="text-center text-sm text-navy-light/40 py-4 font-body">No se encontraron miembros.</p>
        ) : (
          <p className="text-center text-[12px] text-navy-light/60 py-4 font-body">Escribí un nombre para buscar</p>
        )}
      </div>
    </Modal>
  )
}

// ── Change position modal ────────────────────────────────────────────────────

type ChangePositionModalProps = {
  target: CommitteeServer
  newPosition: string
  positions: CommitteePosition[]
  onPositionChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ChangePositionModal({
  target,
  newPosition,
  positions,
  onPositionChange,
  onConfirm,
  onCancel,
}: ChangePositionModalProps) {
  return (
    <Modal onClose={onCancel} titleId="cambiar-puesto" width={384}>
      <div className="p-6 space-y-4">
        <div>
          <p id="cambiar-puesto" className="text-base font-bold text-navy font-display">Cambiar puesto</p>
          <p className="text-sm text-navy-light/60 mt-0.5 font-body">{target.name}</p>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">Nuevo puesto</label>
          <select
            className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            value={newPosition}
            onChange={e => onPositionChange(e.target.value)}
          >
            <option value="">Seleccionar puesto...</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
          <button onClick={onConfirm} disabled={!newPosition} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep disabled:opacity-40 transition-colors font-body">Confirmar</button>
        </div>
      </div>
    </Modal>
  )
}

'use client'

import type { VacationRecordType } from '@/data/mock-employees'
import { cn } from '@/lib/utils'
import { Check, Clock } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

const VACATION_TYPE_LABELS: Record<VacationRecordType, string> = {
  vacaciones:          'Vacaciones',
  permiso_con_goce:    'Permiso con goce',
  permiso_sin_goce:    'Permiso sin goce',
  incapacidad:         'Incapacidad',
}

interface ModalVacacionesProps {
  vacType: VacationRecordType
  vacFrom: string
  vacTo: string
  vacNotes: string
  vacSaved: boolean
  diasHabilesModal: number
  onClose: () => void
  onVacTypeChange: (value: VacationRecordType) => void
  onVacFromChange: (value: string) => void
  onVacToChange: (value: string) => void
  onVacNotesChange: (value: string) => void
  onSave: () => void
}

export function ModalVacaciones({
  vacType,
  vacFrom,
  vacTo,
  vacNotes,
  vacSaved,
  diasHabilesModal,
  onClose,
  onVacTypeChange,
  onVacFromChange,
  onVacToChange,
  onVacNotesChange,
  onSave,
}: ModalVacacionesProps) {
  return (
    <Modal onClose={onClose} titleId="modal-vacaciones" width={448}>
      <div className="p-6 space-y-4">
        {vacSaved ? (
          <div className="text-center space-y-3 py-4">
            <div className="h-12 w-12 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
              <Check size={22} className="text-teal-deep" />
            </div>
            <p className="text-base font-bold text-navy font-display">Solicitud registrada</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <h2 id="modal-vacaciones" className="text-base font-bold text-navy font-display">Registrar solicitud</h2>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40 font-display">Tipo</label>
              <select
                className={cn(inputCls, 'font-body')}
                value={vacType}
                onChange={e => onVacTypeChange(e.target.value as VacationRecordType)}
              >
                {Object.entries(VACATION_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-widests text-navy-light/40 font-display">Desde</label>
                <input
                  type="date"
                  className={cn(inputCls, 'font-body')}
                  value={vacFrom}
                  onChange={e => onVacFromChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-widests text-navy-light/40 font-display">Hasta</label>
                <input
                  type="date"
                  className={cn(inputCls, 'font-body')}
                  value={vacTo}
                  onChange={e => onVacToChange(e.target.value)}
                />
              </div>
            </div>
            {vacFrom && vacTo && (
              <div className="rounded-lg bg-navy/5 px-3 py-2 flex items-center gap-2">
                <Clock size={13} className="text-navy-light/50" />
                <p className="text-[12px] text-navy-light/60 font-body">
                  {diasHabilesModal} día{diasHabilesModal !== 1 ? 's' : ''} hábil{diasHabilesModal !== 1 ? 'es' : ''}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40 font-display">Notas</label>
              <textarea
                className={cn(inputCls, 'resize-none font-body')}
                rows={2}
                placeholder="Descripción de la solicitud..."
                value={vacNotes}
                onChange={e => onVacNotesChange(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!vacFrom || !vacTo}
                className={cn(
                  'rounded-full px-4 py-2 text-sm text-white transition-colors font-body',
                  vacFrom && vacTo ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
                )}
              >
                Guardar solicitud
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

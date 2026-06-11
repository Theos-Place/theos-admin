'use client'

import { cn } from '@/lib/utils'
import { AlertOctagon } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

interface ModalDarDeBajaProps {
  memberName: string
  terminateConfirm: string
  terminateDate: string
  terminateReason: string
  onClose: () => void
  onTerminateConfirmChange: (value: string) => void
  onTerminateDateChange: (value: string) => void
  onTerminateReasonChange: (value: string) => void
  onConfirm: () => void
}

export function ModalDarDeBaja({
  memberName,
  terminateConfirm,
  terminateDate,
  terminateReason,
  onClose,
  onTerminateConfirmChange,
  onTerminateDateChange,
  onTerminateReasonChange,
  onConfirm,
}: ModalDarDeBajaProps) {
  return (
    <Modal onClose={onClose} titleId="modal-dar-de-baja" width={448}>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertOctagon size={18} className="text-coral" />
          <h2 id="modal-dar-de-baja" className="text-base font-bold text-navy font-display">Dar de baja</h2>
        </div>
        <div className="rounded-xl bg-coral/5 border border-coral/20 px-4 py-3">
          <p className="text-[12px] text-coral font-body">
            Esta acción marca al empleado como inactivo. Escribí el nombre completo para confirmar.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widests text-navy-light/40 font-display">
            Escribí "<span className="font-semibold text-navy">{memberName}</span>" para confirmar
          </label>
          <input
            className={cn(inputCls, 'font-body')}
            placeholder={memberName}
            value={terminateConfirm}
            onChange={e => onTerminateConfirmChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widests text-navy-light/40 font-display">Fecha de baja</label>
          <input
            type="date"
            className={cn(inputCls, 'font-body')}
            value={terminateDate}
            onChange={e => onTerminateDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widests text-navy-light/40 font-display">Motivo</label>
          <textarea
            className={cn(inputCls, 'resize-none font-body')}
            rows={2}
            placeholder="Motivo de la baja..."
            value={terminateReason}
            onChange={e => onTerminateReasonChange(e.target.value)}
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
            onClick={onConfirm}
            disabled={terminateConfirm !== memberName}
            className={cn(
              'rounded-full px-4 py-2 text-sm text-white transition-colors font-body',
              terminateConfirm === memberName ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
            )}
          >
            Confirmar baja
          </button>
        </div>
      </div>
    </Modal>
  )
}

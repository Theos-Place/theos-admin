'use client'

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'

type DeleteConfirmModalProps = {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  /** Palabra a escribir para confirmar (default "eliminar"). */
  keyword?: string
  /** Texto del botón de confirmar (default "Confirmar"). */
  confirmLabel?: string
}

/**
 * Modal estándar de confirmación destructiva. El usuario debe escribir
 * exactamente la palabra clave (default "eliminar", case-insensitive) para
 * habilitar el botón de confirmar.
 */
export function DeleteConfirmModal({
  open, title, description, onConfirm, onCancel, loading = false,
  keyword = 'eliminar', confirmLabel,
}: DeleteConfirmModalProps) {
  const [text, setText] = useState('')

  // El input siempre arranca vacío al abrir.
  useEffect(() => { if (open) setText('') }, [open])

  if (!open) return null

  const enabled = text.trim().toLowerCase() === keyword.toLowerCase() && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-lg)]">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-[rgba(239,85,84,0.12)]">
            <Trash2 size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-navy font-display">{title}</p>
            <p className="text-[13px] text-navy-light/60 mt-1 leading-relaxed font-body">
              {description}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] tracking-widest uppercase text-navy-light/40 font-display">
            Escribí <span className="text-coral font-semibold">{keyword}</span> para confirmar
          </label>
          <input
            autoFocus
            className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            placeholder={keyword}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && enabled) onConfirm() }}
          />
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
            disabled={!enabled}
            className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body"
          >
            {loading ? 'Procesando…' : (confirmLabel ?? 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  )
}

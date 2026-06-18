'use client'

import { useState, useRef, useEffect } from 'react'
import { X, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BulkMoreAction = { label: string; onClick: () => void; danger?: boolean }

/** Barra de acciones contextual para selección múltiple. Aparece cuando hay
 *  selección, muestra "N seleccionados", recibe los botones de acción como
 *  children y un menú opcional "Más acciones" para cuando escalen. Genérica:
 *  reutilizable en dirigentes, miembros, puestos, etc. */
export function BulkActionBar({
  count, noun = 'seleccionados', onClear, children, moreActions,
}: {
  count: number
  /** Sustantivo plural para el texto ("3 dirigentes seleccionados"). */
  noun?: string
  onClear: () => void
  children?: React.ReactNode
  moreActions?: BulkMoreAction[]
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setMoreOpen(false) }
    if (moreOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  if (count === 0) return null

  return (
    <div className="sticky top-2 z-20 flex items-center gap-3 rounded-2xl bg-navy px-4 py-2.5 shadow-[var(--shadow-lg)] flex-wrap">
      <button
        onClick={onClear}
        aria-label="Limpiar selección"
        className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      >
        <X size={16} />
      </button>
      <span className="text-sm text-white font-body font-medium">
        {count} {noun}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        {moreActions && moreActions.length > 0 && (
          <div className="relative" ref={ref}>
            <button
              onClick={() => setMoreOpen(o => !o)}
              aria-label="Más acciones"
              aria-expanded={moreOpen}
              className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1.5 text-[13px] text-white hover:bg-white/10 transition-colors font-body"
            >
              <MoreHorizontal size={15} /> Más
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-48 rounded-xl overflow-hidden bg-surface-card shadow-[var(--shadow-lg)] border border-[var(--outline-variant)] py-1">
                {moreActions.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => { setMoreOpen(false); a.onClick() }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-[13px] hover:bg-surface-low transition-colors font-body',
                      a.danger ? 'text-coral' : 'text-navy-light',
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

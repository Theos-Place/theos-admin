'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PopoverProps {
  /** Rect del elemento ancla (getBoundingClientRect, coords de viewport). */
  anchorRect: DOMRect
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** Ancho del panel en desktop (px). En móvil ocupa todo el ancho. */
  width?: number
  titleId?: string
}

const GAP = 6
const MARGIN = 8

/**
 * Popover anclado a un elemento, reposicionado para no salirse del viewport.
 * En pantallas chicas (< sm) se vuelve un bottom sheet a ancho completo.
 * Cierra con click afuera, Escape o la X. Patrón tipo Google Calendar.
 */
export function Popover({ anchorRect, onClose, title, children, width = 320, titleId }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Cerrar con Escape y con click/tap afuera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  // Posición en desktop: debajo del ancla por defecto; arriba si no cabe.
  // Clamp horizontal y vertical al viewport. Se mide tras montar.
  useLayoutEffect(() => {
    if (!mounted || mobile || !ref.current) return
    const panel = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = anchorRect.left
    left = Math.min(Math.max(MARGIN, left), vw - width - MARGIN)
    const spaceBelow = vh - anchorRect.bottom
    let top: number
    if (spaceBelow >= panel.height + GAP || spaceBelow >= anchorRect.top) {
      top = anchorRect.bottom + GAP
    } else {
      top = anchorRect.top - panel.height - GAP
    }
    top = Math.min(Math.max(MARGIN, top), vh - panel.height - MARGIN)
    setPos({ top, left })
  }, [mounted, mobile, anchorRect, width, children])

  if (!mounted) return null

  const header = title && (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--outline-variant)]">
      <p id={titleId} className="text-sm font-semibold text-navy font-display">{title}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="h-7 w-7 flex items-center justify-center rounded-lg text-navy-light/80 hover:bg-surface-low hover:text-navy transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  )

  if (mobile) {
    return createPortal(
      <>
        <div className="fixed inset-0 z-[999] bg-black/30" aria-hidden="true" />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-[1000] max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface-card shadow-[0_-8px_32px_rgba(22,20,64,0.18)] font-body"
        >
          {header}
          <div className="p-2">{children}</div>
        </div>
      </>,
      document.body,
    )
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{ top: pos?.top ?? anchorRect.bottom + GAP, left: pos?.left ?? anchorRect.left, width }}
      className={cn(
        'fixed z-[1000] max-h-[70vh] overflow-y-auto rounded-2xl bg-surface-card shadow-[0_12px_40px_rgba(22,20,64,0.18)] border border-[var(--outline-variant)] font-body',
        pos ? 'opacity-100' : 'opacity-0',
      )}
    >
      {header}
      <div className="p-2">{children}</div>
    </div>,
    document.body,
  )
}

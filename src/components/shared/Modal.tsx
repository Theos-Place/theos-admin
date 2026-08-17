'use client'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function Modal({
  onClose,
  children,
  width = 480,
  titleId,
  tone = 'light',
}: {
  onClose: () => void
  children: React.ReactNode
  width?: number | string
  /** id of the heading inside the modal — links aria-labelledby */
  titleId?: string
  /** 'dark' para páginas con fondo navy (ej. check-in): panel y X claros. */
  tone?: 'light' | 'dark'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Focus trap
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    // Move focus inside on mount
    const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE)
    firstFocusable?.focus()

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = Array.from(panel!.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }

    panel.addEventListener('keydown', handleTab)
    return () => panel.removeEventListener('keydown', handleTab)
  }, [])

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      role="presentation"
      className="fixed inset-0 bg-black/45 z-[1000] flex items-center justify-center p-5"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          tone === 'dark'
            ? 'bg-navy border border-white/10 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] relative max-h-[90vh] overflow-y-auto w-full'
            : 'bg-surface-card rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.2)] relative max-h-[90vh] overflow-y-auto w-full'
        }
        style={{ maxWidth: width }}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar modal"
          className={
            tone === 'dark'
              ? 'absolute top-[14px] right-[14px] bg-transparent border-none cursor-pointer text-white/70 hover:text-white z-[1]'
              : 'absolute top-[14px] right-[14px] bg-transparent border-none cursor-pointer text-[rgba(41,54,92,0.4)] hover:text-navy z-[1]'
          }
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}

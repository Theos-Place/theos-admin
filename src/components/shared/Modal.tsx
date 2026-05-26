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
}: {
  onClose: () => void
  children: React.ReactNode
  width?: number | string
  /** id of the heading inside the modal — links aria-labelledby */
  titleId?: string
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ background: 'var(--surface-card)', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative', maxHeight: '90vh', overflowY: 'auto', width: '100%', maxWidth: width }}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar modal"
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(41,54,92,0.4)', zIndex: 1 }}
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}

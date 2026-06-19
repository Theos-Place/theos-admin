'use client'

import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RowAction = {
  label: string
  icon?: React.ReactNode
  href?: string
  onClick?: () => void
  danger?: boolean
}

/**
 * Menú de acciones por fila (kebab de 3 puntos). El dropdown se renderiza en un
 * PORTAL con position: fixed y z-index alto, anclado al botón y reposicionado
 * dentro del viewport — así NUNCA lo recorta el `overflow-hidden`/`overflow-x-auto`
 * del contenedor de la tabla (mismo enfoque que los date pickers). Autogestiona
 * su estado abierto/cerrado: cierra con click afuera, Escape, scroll o resize.
 */
export function RowActionsMenu({
  actions, label = 'Acciones', width = 180, triggerClassName,
}: {
  actions: RowAction[]
  label?: string
  width?: number
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Posición: borde derecho del menú alineado al botón, debajo por defecto;
  // arriba si no cabe. Clamp al viewport.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const menuH = menuRef.current?.offsetHeight ?? actions.length * 40 + 8
    const vw = window.innerWidth, vh = window.innerHeight
    const MARGIN = 8, GAP = 6
    let left = Math.min(Math.max(MARGIN, r.right - width), vw - width - MARGIN)
    let top = r.bottom + GAP
    if (top + menuH > vh - MARGIN) top = Math.max(MARGIN, r.top - menuH - GAP)
    setPos({ top, left })
  }, [open, width, actions.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    // capture: cierra aunque el scroll ocurra en un contenedor interno.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/60 hover:text-navy hover:bg-surface-low transition-colors',
          triggerClassName,
        )}
      >
        <MoreVertical size={14} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width }}
          className={cn(
            'fixed z-[1000] rounded-xl overflow-hidden bg-surface-card shadow-[var(--shadow-lg)] border border-[var(--outline-variant)] py-1 font-body',
            pos ? 'opacity-100' : 'opacity-0',
          )}
        >
          {actions.map((a, i) => {
            const cls = cn(
              'w-full flex items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors',
              a.danger ? 'text-coral hover:bg-coral/5' : 'text-navy hover:bg-surface-low',
            )
            return a.href ? (
              <Link key={i} href={a.href} role="menuitem" onClick={() => setOpen(false)} className={cls}>
                {a.icon}{a.label}
              </Link>
            ) : (
              <button key={i} type="button" role="menuitem" onClick={() => { setOpen(false); a.onClick?.() }} className={cls}>
                {a.icon}{a.label}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}

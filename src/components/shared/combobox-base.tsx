'use client'

/**
 * Primitivas compartidas de los comboboxes (Combobox, MemberCombobox,
 * DirigentesCombobox). Cada uno conserva su modelo de interacción (catálogo
 * con "crear", búsqueda server-side, selección con avatar), pero la mecánica
 * común —cierre al clic fuera, navegación con teclado, panel, filas y estado
 * vacío— vive acá una sola vez.
 */
import { useState, useEffect, type RefObject, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Cierra el dropdown al hacer clic fuera del contenedor. */
export function useDismissOnOutsideClick(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
    // onClose estable por construcción en los consumidores (setState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref])
}

/** Navegación de lista con flechas/Enter/Escape + índice resaltado. */
export function useListNavigation({ count, onPick, onClose }: {
  count: number
  onPick: (index: number) => void
  onClose?: () => void
}) {
  const [highlight, setHighlight] = useState(0)

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose?.(); return }
    if (count === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, count - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlight < count) onPick(highlight) }
  }

  return { highlight, setHighlight, onKeyDown }
}

/** Contenedor flotante del dropdown (posición, borde, sombra, scroll). */
export function ComboPanel({ children, rounded = 'xl', className }: {
  children: ReactNode
  rounded?: 'xl' | '2xl'
  className?: string
}) {
  return (
    <div className={cn(
      'absolute top-full left-0 right-0 mt-1 z-30 border border-[var(--outline-variant)] bg-surface-card overflow-hidden',
      rounded === '2xl' ? 'rounded-2xl shadow-[var(--shadow-lg)]' : 'rounded-xl shadow-[var(--shadow-md)]',
      className,
    )}>
      {children}
    </div>
  )
}

/** Fila de opción con estado resaltado; el contenido lo pone cada combobox. */
export function ComboOption({ highlighted, selected, onHover, onPick, children, className }: {
  highlighted?: boolean
  selected?: boolean
  onHover?: () => void
  onPick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
        highlighted ? 'bg-surface-low' : 'hover:bg-surface-low',
        selected && 'bg-coral/5',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Avatar circular de iniciales usado en las opciones con persona. */
export function OptionAvatar({ initials, size = 7 }: { initials: string; size?: 7 | 8 }) {
  return (
    <span className={cn(
      'flex shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[11px] font-display font-extrabold',
      size === 8 ? 'h-8 w-8' : 'h-7 w-7',
    )}>
      {initials || '—'}
    </span>
  )
}

export function NoResults({ children = 'Sin resultados' }: { children?: ReactNode }) {
  return <p className="px-3 py-3 text-[13px] text-navy-light/80 font-body">{children}</p>
}

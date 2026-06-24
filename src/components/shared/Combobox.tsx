'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ComboItem = { value: string; label: string }

/** Resultado del combobox: una opción existente, una NUEVA (texto libre, se crea
 *  al guardar), o vacío. */
export type ComboValue =
  | { kind: 'existing'; value: string; label: string }
  | { kind: 'new'; label: string }
  | { kind: 'empty' }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

/**
 * Combobox con autocompletado para catálogos: filtra opciones existentes y, si se
 * escribe algo que no existe, ofrece "Crear nueva…" (la creación real la hace quien
 * lo usa, al guardar). Reutilizable para zonas u otros catálogos.
 */
export function Combobox({
  items,
  value,
  onChange,
  placeholder = 'Buscar o escribir…',
  allowCreate = true,
  createLabel = (t) => `Crear nueva: “${t}”`,
  allowEmpty = false,
  emptyLabel = 'Sin selección',
  ariaLabel,
}: {
  items: ComboItem[]
  value: ComboValue
  onChange: (v: ComboValue) => void
  placeholder?: string
  allowCreate?: boolean
  createLabel?: (text: string) => string
  allowEmpty?: boolean
  emptyLabel?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) { document.addEventListener('mousedown', h); inputRef.current?.focus() }
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const q = query.trim()
  const filtered = q ? items.filter(it => norm(it.label).includes(norm(q))) : items
  const exact = items.some(it => norm(it.label) === norm(q))
  const showCreate = allowCreate && q.length > 0 && !exact

  const display = value.kind === 'empty' ? '' : value.label

  function pickExisting(it: ComboItem) { onChange({ kind: 'existing', value: it.value, label: it.label }); setQuery(''); setOpen(false) }
  function pickNew() { if (!q) return; onChange({ kind: 'new', label: q }); setQuery(''); setOpen(false) }
  function pickEmpty() { onChange({ kind: 'empty' }); setQuery(''); setOpen(false) }

  const triggerCls = 'w-full flex items-center gap-2 rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-left'

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className={triggerCls} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}>
        <span className={cn('flex-1 truncate text-sm font-body', display ? 'text-navy' : 'text-navy-light/50')}>
          {display || placeholder}
        </span>
        {value.kind === 'new' && (
          <span className="shrink-0 rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-medium text-coral font-body">nueva</span>
        )}
        <ChevronDown size={15} className="shrink-0 text-navy-light/50" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 rounded-xl border border-[var(--outline-variant)] bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--outline-variant)] px-3 py-2">
            <Search size={14} className="shrink-0 text-navy-light/60" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (filtered.length) pickExisting(filtered[0]); else if (showCreate) pickNew() } else if (e.key === 'Escape') setOpen(false) }}
              placeholder={placeholder}
              aria-label={ariaLabel ?? placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-navy placeholder:text-navy-light/50 outline-none font-body"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {allowEmpty && (
              <button type="button" onClick={pickEmpty} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-navy-light/70 hover:bg-surface-low font-body">
                <span className="flex-1">{emptyLabel}</span>
                {value.kind === 'empty' && <Check size={14} className="text-coral" />}
              </button>
            )}
            {filtered.map(it => (
              <button key={it.value} type="button" onClick={() => pickExisting(it)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-navy hover:bg-surface-low font-body">
                <span className="flex-1 truncate">{it.label}</span>
                {value.kind === 'existing' && value.value === it.value && <Check size={14} className="text-coral" />}
              </button>
            ))}
            {showCreate && (
              <button type="button" onClick={pickNew} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-coral hover:bg-coral/5 font-body border-t border-[var(--outline-variant)]">
                <Plus size={14} className="shrink-0" />
                <span className="flex-1 truncate">{createLabel(q)}</span>
              </button>
            )}
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-3 text-[12px] text-navy-light/60 font-body">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

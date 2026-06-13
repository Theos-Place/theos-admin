'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useDirigentes } from '@/hooks/useDirigentes'
import { cn } from '@/lib/utils'
import { Search, X, ChevronDown } from 'lucide-react'
import { getInitials } from '@/lib/format'

type DirigentesComboboxProps = {
  value: string | null              // member_id seleccionado
  onChange: (id: string | null) => void
  placeholder?: string
  excludeId?: string                // member_id a excluir (el del otro campo)
}

function StatusBadge({ status }: { status: 'activo' | 'inactivo' }) {
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[10px] font-medium font-body shrink-0',
      status === 'activo' ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-surface-low text-navy-light/60',
    )}>
      {status === 'activo' ? 'Activo' : 'Inactivo'}
    </span>
  )
}

export function DirigentesCombobox({ value, onChange, placeholder = 'Seleccionar dirigente…', excludeId }: DirigentesComboboxProps) {
  const { dirigentes } = useDirigentes()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [highlight, setHighlight] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = dirigentes.find(d => d.member_id === value)

  const options = useMemo(() => {
    const term = q.trim().toLowerCase()
    return dirigentes
      .filter(d => d.member_id !== excludeId)
      .filter(d => !term || d.member_name.toLowerCase().includes(term))
      .slice(0, 50)
  }, [dirigentes, q, excludeId])

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Al abrir, foco en el buscador y reset del resaltado.
  useEffect(() => {
    if (open) { setHighlight(0); setTimeout(() => inputRef.current?.focus(), 0) }
    else setQ('')
  }, [open])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const o = options[highlight]; if (o) pick(o.member_id) }
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-surface-low px-3 py-2 focus-within:ring-1 focus-within:ring-coral/30">
        {selected && !open && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
            {getInitials(selected.member_name) || '—'}
          </span>
        )}
        <input
          ref={inputRef}
          value={open ? q : (selected?.member_name ?? '')}
          onChange={e => { setQ(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selected ? selected.member_name : placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-navy outline-none font-body placeholder:text-navy-light/50"
        />
        {selected && !open ? <StatusBadge status={selected.status} /> : null}
        {value ? (
          <button type="button" onClick={() => { onChange(null); setQ('') }} className="text-navy-light/60 hover:text-coral shrink-0" aria-label="Limpiar">
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={15} className="text-navy-light/60 shrink-0" />
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl bg-surface-card shadow-[var(--shadow-lg)] border border-[var(--outline-variant)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--outline-variant)]">
            <Search size={14} className="text-navy-light/60 shrink-0" />
            <span className="text-xs text-navy-light/60 font-body">Buscá por nombre…</span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="px-3 py-3 text-xs text-navy-light/60 font-body">Sin resultados</p>
            ) : options.map((d, i) => (
              <button
                key={d.member_id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(d.member_id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 transition-colors text-left',
                  i === highlight ? 'bg-surface-low' : 'hover:bg-surface-low',
                  d.member_id === value && 'bg-coral/5',
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
                  {getInitials(d.member_name) || '—'}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">{d.member_name}</span>
                <StatusBadge status={d.status} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

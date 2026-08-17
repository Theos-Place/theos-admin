'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useDirigentes } from '@/hooks/useDirigentes'
import { cn } from '@/lib/utils'
import { Search, X, ChevronDown } from 'lucide-react'
import { getInitials } from '@/lib/format'
import {
  useDismissOnOutsideClick, useListNavigation, ComboPanel, ComboOption, OptionAvatar, NoResults,
} from './combobox-base'

type DirigentesComboboxProps = {
  value: string | null              // member_id seleccionado
  onChange: (id: string | null) => void
  placeholder?: string
  excludeId?: string                // member_id a excluir (el del otro campo)
}

function StatusBadge({ status }: { status: 'activo' | 'inactivo' }) {
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[11px] font-medium font-body shrink-0',
      status === 'activo' ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-surface-low text-navy-light/70',
    )}>
      {status === 'activo' ? 'Activo' : 'Inactivo'}
    </span>
  )
}

export function DirigentesCombobox({ value, onChange, placeholder = 'Seleccionar dirigente…', excludeId }: DirigentesComboboxProps) {
  const { dirigentes } = useDirigentes()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
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

  useDismissOnOutsideClick(ref, open, () => setOpen(false))

  const { highlight, setHighlight, onKeyDown } = useListNavigation({
    count: options.length,
    onPick: i => pick(options[i].member_id),
    onClose: () => setOpen(false),
  })

  // Al abrir, foco en el buscador y reset del resaltado.
  useEffect(() => {
    if (open) { setHighlight(0); setTimeout(() => inputRef.current?.focus(), 0) }
    else setQ('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-surface-low px-3 py-2 focus-within:ring-1 focus-within:ring-coral/30">
        {selected && !open && (
          <OptionAvatar initials={getInitials(selected.member_name)} />
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
          <button type="button" onClick={() => { onChange(null); setQ('') }} className="text-navy-light/70 hover:text-coral shrink-0" aria-label="Limpiar">
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={15} className="text-navy-light/70 shrink-0" />
        )}
      </div>

      {open && (
        <ComboPanel rounded="2xl">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--outline-variant)]">
            <Search size={14} className="text-navy-light/70 shrink-0" />
            <span className="text-xs text-navy-light/70 font-body">Buscá por nombre…</span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <NoResults />
            ) : options.map((d, i) => (
              <ComboOption
                key={d.member_id}
                highlighted={i === highlight}
                selected={d.member_id === value}
                onHover={() => setHighlight(i)}
                onPick={() => pick(d.member_id)}
              >
                <OptionAvatar initials={getInitials(d.member_name)} />
                <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">{d.member_name}</span>
                <StatusBadge status={d.status} />
              </ComboOption>
            ))}
          </div>
        </ComboPanel>
      )}
    </div>
  )
}

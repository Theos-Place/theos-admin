'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Search } from 'lucide-react'
import { useOrg } from '@/lib/org'
import { cn } from '@/lib/utils'

interface CommitteeMultiSelectProps {
  /** Ids de comités (áreas) seleccionados. */
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

/** Buscador de comités con selección múltiple (chips). value = ids de áreas-comité. */
export function CommitteeMultiSelect({ value, onChange, placeholder = 'Buscar comité…' }: CommitteeMultiSelectProps) {
  const { adminCommittees } = useOrg()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const nameById = useMemo(
    () => Object.fromEntries(adminCommittees.map(c => [c.id, c.name])),
    [adminCommittees],
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return adminCommittees
      .filter(c => !value.includes(c.id) && (q === '' || c.name.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [adminCommittees, query, value])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function add(id: string) {
    onChange([...value, id])
    setQuery('')
  }
  function remove(id: string) {
    onChange(value.filter(x => x !== id))
  }

  return (
    <div ref={ref} className="relative">
      {/* Chips de seleccionados */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(id => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-navy/10 text-navy px-2.5 py-1 text-[13px] font-body">
              {nameById[id] ?? 'Comité'}
              <button type="button" onClick={() => remove(id)} aria-label={`Quitar ${nameById[id] ?? 'comité'}`} className="text-navy-light/80 hover:text-coral">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 focus-within:ring-1 focus-within:ring-coral/30">
        <Search size={15} className="text-navy-light/80 shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/40 outline-none font-body"
        />
      </div>

      {open && matches.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl bg-surface-card p-1.5 shadow-[var(--shadow-lg)] border border-[var(--outline-variant)]">
          {matches.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => add(c.id)}
              className={cn('w-full rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-surface-low transition-colors font-body')}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

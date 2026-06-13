'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initialsFromParts } from '@/lib/format'

/** Fila de miembro tal como la devuelve `GET /api/members`. */
export type MemberHit = {
  id: string
  first_name: string
  last_name: string
  cedula: string | null
  email?: string | null
  occupation?: string | null
}

type MemberComboboxProps = {
  onSelect: (m: MemberHit) => void
  placeholder?: string
  autoFocus?: boolean
  /** Cantidad de resultados a pedir (default 8, máx útil 20). */
  pageSize?: number
  /** Mínimo de caracteres antes de buscar (default 2). */
  minChars?: number
  /** IDs a excluir de los resultados (p. ej. ya tienen acceso / ya contratados). */
  excludeIds?: string[]
  /** true: resultados en dropdown flotante; false (default): lista en el flujo. */
  dropdown?: boolean
  /** 'onDark' para usar sobre fondos navy (header). */
  variant?: 'default' | 'onDark'
  /** Línea secundaria de cada opción. Default: cédula (o "Sin cédula"). */
  secondaryText?: (m: MemberHit) => string | null
  /** Texto al final de cada opción (p. ej. ocupación). */
  metaText?: (m: MemberHit) => string | null
  /** Contenido a mostrar mientras no se alcanza `minChars`. */
  emptyState?: ReactNode
}

function initials(m: MemberHit) {
  return initialsFromParts(m.first_name, m.last_name) || '—'
}

/**
 * Buscador compartido de miembros contra `GET /api/members?search=…` con
 * debounce de 300ms. Al elegir una opción se llama `onSelect` y se limpia
 * la búsqueda (el estado "seleccionado" lo maneja quien lo usa).
 */
export function MemberCombobox({
  onSelect,
  placeholder = 'Buscar miembro por nombre o cédula…',
  autoFocus,
  pageSize = 8,
  minChars = 2,
  excludeIds,
  dropdown = false,
  variant = 'default',
  secondaryText,
  metaText,
  emptyState,
}: MemberComboboxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberHit[]>([])
  const [searching, setSearching] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const excludeKey = excludeIds?.join(',') ?? ''

  useEffect(() => {
    const q = query.trim()
    if (q.length < minChars) { setResults([]); setSearching(false); return }
    const ctrl = new AbortController()
    let alive = true
    setSearching(true)
    const t = setTimeout(() => {
      fetch(`/api/members?search=${encodeURIComponent(q)}&pageSize=${pageSize}`, { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : { members: [] }))
        .then(d => {
          if (!alive) return
          const excluded = excludeKey ? excludeKey.split(',') : []
          setResults(((d.members ?? []) as MemberHit[]).filter(m => !excluded.includes(m.id)))
          setHighlight(0)
          setSearching(false)
        })
        .catch(() => { if (alive) setSearching(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t); ctrl.abort() }
  }, [query, minChars, pageSize, excludeKey])

  function pick(m: MemberHit) {
    setQuery('')
    setResults([])
    onSelect(m)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const m = results[highlight]; if (m) pick(m) }
    else if (e.key === 'Escape') { setResults([]) }
  }

  const onDark = variant === 'onDark'
  const belowMin = query.trim().length < minChars

  return (
    <div className={cn(dropdown && 'relative')}>
      <div className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2.5',
        onDark ? 'border-white/20 bg-white/10' : 'border-outline bg-surface-low',
      )}>
        <Search size={14} className={cn('shrink-0', onDark ? 'text-white/40' : 'text-navy-light/40')} />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-sm outline-none font-body',
            onDark ? 'text-white placeholder-white/40' : 'text-navy placeholder:text-navy-light/50',
          )}
        />
        {searching && <Loader2 size={13} className={cn('animate-spin', onDark ? 'text-white/40' : 'text-navy-light/40')} />}
      </div>

      {results.length > 0 && (
        <div className={cn(
          'rounded-xl border border-[var(--outline-variant)] overflow-hidden bg-surface-card',
          dropdown
            ? 'absolute top-full left-0 right-0 mt-1 z-20 shadow-[var(--shadow-md)] max-h-64 overflow-y-auto'
            : 'mt-2 max-h-64 overflow-y-auto divide-y divide-[var(--outline-variant)]',
        )}>
          {results.map((m, i) => {
            const secondary = secondaryText ? secondaryText(m) : (m.cedula ?? 'Sin cédula')
            const meta = metaText?.(m)
            return (
              <button
                key={m.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(m)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  i === highlight ? 'bg-surface-low' : 'hover:bg-surface-low',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
                  {initials(m)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-navy font-body">{m.first_name} {m.last_name}</span>
                  {secondary && <span className="block truncate text-[11px] text-navy-light/60 font-body">{secondary}</span>}
                </span>
                {meta && <span className="text-[11px] text-navy-light/60 shrink-0 font-body">{meta}</span>}
              </button>
            )
          })}
        </div>
      )}

      {!belowMin && !searching && results.length === 0 && (
        <p className={cn('mt-2 text-[12px] font-body', onDark ? 'text-white/70' : 'text-navy-light/60')}>
          Sin resultados
        </p>
      )}

      {belowMin && emptyState}
    </div>
  )
}

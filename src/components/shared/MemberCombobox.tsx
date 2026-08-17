'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initialsFromParts } from '@/lib/format'
import { useListNavigation, ComboOption, OptionAvatar } from './combobox-base'

/** Buscador para pantallas de GESTIÓN que no tienen el módulo miembros
 *  (check-in, becas, agregar a un grupo, accesos de formularios). Devuelve lo
 *  justo para reconocer a alguien; el padrón sigue exigiendo su módulo. */
export const MEMBER_LOOKUP_URL = '/api/members/lookup'

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
  /** Endpoint alternativo con la misma respuesta `{ members }`. Default
   *  `/api/members` (exige el módulo miembros). */
  searchUrl?: string
}

function initials(m: MemberHit) {
  return initialsFromParts(m.first_name, m.last_name) || '—'
}

/**
 * Buscador compartido de miembros contra `GET /api/members?search=…` con
 * debounce de 300ms. Al elegir una opción se llama `onSelect` y se limpia
 * la búsqueda (el estado "seleccionado" lo maneja quien lo usa).
 *
 * `searchUrl` permite apuntar a OTRO endpoint con la misma forma de respuesta
 * (`{ members: [...] }`). Existe porque /api/members exige el módulo miembros:
 * una pantalla cuyo permiso es otro (dar acceso a un formulario, por ejemplo)
 * necesita buscar personas sin que eso implique abrirle el padrón entero.
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
  searchUrl = '/api/members',
}: MemberComboboxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberHit[]>([])
  const [searching, setSearching] = useState(false)

  const { highlight, setHighlight, onKeyDown } = useListNavigation({
    count: results.length,
    onPick: i => { const m = results[i]; if (m) pick(m) },
    onClose: () => setResults([]),
  })

  const excludeKey = excludeIds?.join(',') ?? ''

  useEffect(() => {
    const q = query.trim()
    if (q.length < minChars) { setResults([]); setSearching(false); return }
    const ctrl = new AbortController()
    let alive = true
    const t = setTimeout(() => {
      setSearching(true)
      const sep = searchUrl.includes('?') ? '&' : '?'
      fetch(`${searchUrl}${sep}search=${encodeURIComponent(q)}&pageSize=${pageSize}`, { signal: ctrl.signal })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, minChars, pageSize, excludeKey, searchUrl])

  function pick(m: MemberHit) {
    setQuery('')
    setResults([])
    onSelect(m)
  }

  const onDark = variant === 'onDark'
  const belowMin = query.trim().length < minChars

  return (
    <div className={cn(dropdown && 'relative')}>
      <div className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2.5',
        onDark ? 'border-white/20 bg-white/10' : 'border-outline bg-surface-low',
      )}>
        <Search size={14} className={cn('shrink-0', onDark ? 'text-white/70' : 'text-navy-light/70')} />
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
        {searching && <Loader2 size={13} className={cn('animate-spin', onDark ? 'text-white/70' : 'text-navy-light/70')} />}
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
              <ComboOption
                key={m.id}
                highlighted={i === highlight}
                onHover={() => setHighlight(i)}
                onPick={() => pick(m)}
                className="gap-3 py-2.5"
              >
                <OptionAvatar initials={initials(m)} size={8} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-navy font-body">{m.first_name} {m.last_name}</span>
                  {secondary && <span className="block truncate text-[12px] text-navy-light/70 font-body">{secondary}</span>}
                </span>
                {meta && <span className="text-[12px] text-navy-light/70 shrink-0 font-body">{meta}</span>}
              </ComboOption>
            )
          })}
        </div>
      )}

      {!belowMin && !searching && results.length === 0 && (
        <p className={cn('mt-2 text-[12px] font-body', onDark ? 'text-white/70' : 'text-navy-light/70')}>
          Sin resultados
        </p>
      )}

      {belowMin && emptyState}
    </div>
  )
}

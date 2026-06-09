import { Search, Check, X, User } from 'lucide-react'
import { type Member } from '@/data/mock-members'
import { cn } from '@/lib/utils'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

interface StepPersonSearchProps {
  query: string
  onQueryChange: (q: string) => void
  searchResults: Member[]
  selected: Member | null
  onSelect: (m: Member) => void
  onClear: () => void
}

export function StepPersonSearch({
  query,
  onQueryChange,
  searchResults,
  selected,
  onSelect,
  onClear,
}: StepPersonSearchProps) {
  return (
    <div
      className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]"
    >
      <p
        className="text-[11px] tracking-widths uppercase text-navy-light/40 font-display"
      >
        Paso 1 — Buscar miembro
      </p>

      {selected ? (
        <div
          className="rounded-xl border border-[var(--outline-variant)] p-4 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-navy flex items-center justify-center shrink-0">
              <span
                className="text-[13px] font-bold text-white font-display"
              >
                {selected.first_name[0]}{selected.last_name[0]}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy font-display">
                {selected.first_name} {selected.last_name}
              </p>
              <p className="truncate text-[12px] text-navy-light/50 font-body">
                {selected.email}
              </p>
              {selected.cedula && (
                <p className="text-[11px] text-navy-light/40 font-mono">
                  {selected.cedula}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-7 w-7 rounded-full bg-teal-soft/30 flex items-center justify-center">
              <Check size={14} className="text-teal-deep" />
            </div>
            <button
              type="button"
              onClick={onClear}
              className="h-7 w-7 rounded-full hover:bg-surface-low flex items-center justify-center transition-colors"
            >
              <X size={13} className="text-navy-light/40" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
            <input
              autoFocus
              className={cn(inputCls, 'pl-9 font-body')}
              placeholder="Buscar por nombre, email o cédula..."
              value={query}
              onChange={e => onQueryChange(e.target.value)}
            />
          </div>

          {query.trim() !== '' && (
            <div
              className="rounded-xl overflow-hidden border border-[var(--outline-variant)]"
            >
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-navy-light/40 font-body">
                    No se encontraron miembros disponibles.
                  </p>
                </div>
              ) : (
                searchResults.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelect(m)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-low transition-colors border-[var(--outline-variant)]',
                      idx > 0 && 'border-t'
                    )}
                  >
                    <div className="h-9 w-9 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                      <span
                        className="text-[10px] font-bold text-navy-light/60 font-display"
                      >
                        {m.first_name[0]}{m.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium text-navy truncate font-body"
                      >
                        {m.first_name} {m.last_name}
                      </p>
                      <p
                        className="text-[11px] text-navy-light/50 truncate font-body"
                      >
                        {m.email}
                        {m.cedula && <span className="ml-2 font-mono">{m.cedula}</span>}
                      </p>
                    </div>
                    <span
                      className="text-[11px] text-navy-light/30 shrink-0 font-body"
                    >
                      {m.occupation}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {query.trim() === '' && (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="h-12 w-12 rounded-full bg-navy/5 flex items-center justify-center">
                <User size={20} className="text-navy-light/30" />
              </div>
              <p className="text-sm text-navy-light/40 font-body">
                Escribí el nombre o cédula del miembro
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

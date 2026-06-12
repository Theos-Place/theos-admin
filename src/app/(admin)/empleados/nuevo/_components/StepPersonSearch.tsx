import { Check, X, User } from 'lucide-react'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'

interface StepPersonSearchProps {
  /** IDs de miembros ya contratados (se excluyen de los resultados). */
  excludeIds: string[]
  selected: MemberHit | null
  onSelect: (m: MemberHit) => void
  onClear: () => void
}

export function StepPersonSearch({
  excludeIds,
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
              {selected.email && (
                <p className="truncate text-[12px] text-navy-light/60 font-body">
                  {selected.email}
                </p>
              )}
              {selected.cedula && (
                <p className="text-[11px] text-navy-light/60 font-mono">
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
              aria-label="Quitar miembro seleccionado"
              className="h-7 w-7 rounded-full hover:bg-surface-low flex items-center justify-center transition-colors"
            >
              <X size={13} className="text-navy-light/60" />
            </button>
          </div>
        </div>
      ) : (
        <MemberCombobox
          autoFocus
          excludeIds={excludeIds}
          placeholder="Buscar por nombre, email o cédula..."
          onSelect={onSelect}
          secondaryText={m => [m.email, m.cedula].filter(Boolean).join(' · ') || null}
          metaText={m => m.occupation ?? null}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="h-12 w-12 rounded-full bg-navy/5 flex items-center justify-center">
                <User size={20} className="text-navy-light/60" />
              </div>
              <p className="text-sm text-navy-light/60 font-body">
                Escribí el nombre o cédula del miembro
              </p>
            </div>
          }
        />
      )}
    </div>
  )
}

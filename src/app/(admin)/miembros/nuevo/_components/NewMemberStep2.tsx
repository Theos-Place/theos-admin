import { X, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FamilyDraft } from '@/components/members/FamilyMemberModal'

type Props = {
  comesWithFamily: boolean | null
  onComesWithFamilyChange: (val: boolean) => void
  familyMembers: FamilyDraft[]
  onOpenModal: () => void
  onRemoveFamilyMember: (idx: number) => void
  draftName: (d: FamilyDraft) => string
  draftInitials: (d: FamilyDraft) => string
  draftIsMinor: (d: FamilyDraft) => boolean
}

export function NewMemberStep2({
  comesWithFamily,
  onComesWithFamilyChange,
  familyMembers,
  onOpenModal,
  onRemoveFamilyMember,
  draftName,
  draftInitials,
  draftIsMinor,
}: Props) {
  return (
    <div className="space-y-5">
      <h2 className="text-sm font-medium text-navy font-display font-extrabold">
        Núcleo familiar
      </h2>

      <div className="space-y-2">
        <p className="text-sm text-navy font-body">
          ¿Esta persona viene con familia?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([[true, 'Sí, viene con familia'], [false, 'No, viene solo']] as const).map(([val, label]) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onComesWithFamilyChange(val)}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm transition-all text-left font-body',
                comesWithFamily === val ? 'bg-navy text-white border-navy' : 'text-navy-light/70 hover:bg-surface-low',
              )}
              style={{ borderColor: comesWithFamily === val ? undefined : 'var(--outline-variant)' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {comesWithFamily && (
        <div className="space-y-3">
          {familyMembers.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-3">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-display font-extrabold',
                  item.kind === 'linked' ? 'bg-teal-deep' : 'bg-navy',
                )}
              >
                {draftInitials(item)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-navy truncate font-body">{draftName(item)}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="rounded-full bg-teal-soft/30 px-2 py-0.5 text-[11px] text-teal-deep font-body">
                    {item.relation}
                  </span>
                  {item.kind === 'linked' ? (
                    <span className="rounded-full bg-teal-soft/50 px-2 py-0.5 text-[11px] text-teal-deep font-body">⇄ Perfil existente</span>
                  ) : (
                    <span className="rounded-full bg-surface-card px-2 py-0.5 text-[11px] text-navy-light/70 font-body">Perfil nuevo</span>
                  )}
                  {draftIsMinor(item) && (
                    <span className="rounded-full bg-coral px-2 py-0.5 text-[11px] font-bold text-white font-display">Menor</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFamilyMember(idx)}
                className="rounded-lg p-1.5 text-navy-light/70 hover:text-coral hover:bg-surface-card transition-all"
                aria-label="Eliminar familiar"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={onOpenModal}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--outline-variant)] py-3 text-sm text-navy-light/70 hover:border-coral/40 hover:text-coral transition-all font-body"
          >
            <UserPlus size={15} /> Agregar integrante
          </button>
        </div>
      )}
    </div>
  )
}

import { X } from 'lucide-react'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { cn } from '@/lib/utils'
import type { Member } from '@/data/mock-members'

type FamilyManualData = {
  first_name: string
  last_name: string
  relation: string
  birth_date: string
  email: string
  phone: string
}

type FamilyItem =
  | { kind: 'linked'; member: Member; relation: string }
  | { kind: 'new'; data: FamilyManualData; cedula: string }

type FamilyLookupState =
  | { state: 'idle' }
  | { state: 'found'; member: Member }
  | { state: 'not-found' }
  | { state: 'manual' }

const inputCls =
  'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy placeholder-navy-light/40 outline-none focus:ring-1 focus:ring-coral/30 transition-all border-0'

const selectCls =
  'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 transition-all border-0 appearance-none'

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="block text-[11px] font-medium text-navy-light/50 mb-1.5 uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {label}
        {required && <span className="text-coral ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-coral mt-1" style={{ fontFamily: 'var(--font-body)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

type Props = {
  hasFamily: boolean
  onHasFamilyToggle: () => void
  familyMembers: FamilyItem[]
  addingFamily: boolean
  onSetAddingFamily: (val: boolean) => void
  familyCedulaInput: string
  onFamilyCedulaInputChange: (val: string) => void
  onFamilyCedulaBlur: () => void
  familyLookup: FamilyLookupState
  newFamilyManual: FamilyManualData
  onNewFamilyManualChange: (updates: Partial<FamilyManualData>) => void
  familyManualErrors: Partial<Record<string, string>>
  isFamilyMinor: boolean
  parentLastName: string
  onAddFamilyMember: () => void
  onResetFamilyForm: () => void
  onRemoveFamilyMember: (idx: number) => void
  familyItemName: (item: FamilyItem) => string
  familyItemInitials: (item: FamilyItem) => string
  familyItemRelation: (item: FamilyItem) => string
}

export function NewMemberStep2({
  hasFamily,
  onHasFamilyToggle,
  familyMembers,
  addingFamily,
  onSetAddingFamily,
  familyCedulaInput,
  onFamilyCedulaInputChange,
  onFamilyCedulaBlur,
  familyLookup,
  newFamilyManual,
  onNewFamilyManualChange,
  familyManualErrors,
  isFamilyMinor,
  parentLastName,
  onAddFamilyMember,
  onResetFamilyForm,
  onRemoveFamilyMember,
  familyItemName,
  familyItemInitials,
  familyItemRelation,
}: Props) {
  return (
    <div className="space-y-5">
      <h2
        className="text-sm font-medium text-navy"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
      >
        Núcleo familiar
      </h2>

      {/* Toggle */}
      <div className="flex items-center justify-between rounded-xl bg-surface-low px-4 py-3">
        <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
          ¿Viene con familia?
        </span>
        <button
          type="button"
          onClick={onHasFamilyToggle}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            hasFamily ? 'bg-coral' : 'bg-navy-light/20'
          )}
          aria-checked={hasFamily}
          role="switch"
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              hasFamily ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {hasFamily && (
        <div className="space-y-3">
          {/* Listed family members */}
          {familyMembers.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-3"
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs',
                  item.kind === 'linked' ? 'bg-teal-deep' : 'bg-navy'
                )}
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                {familyItemInitials(item)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>
                  {familyItemName(item)}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="rounded-full bg-teal-soft/30 px-2 py-0.5 text-[10px] text-teal-deep"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {familyItemRelation(item)}
                  </span>
                  {item.kind === 'linked' ? (
                    <span
                      className="rounded-full bg-teal-soft/50 px-2 py-0.5 text-[10px] text-teal-deep flex items-center gap-1"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      <span>⇄</span> Perfil existente
                    </span>
                  ) : (
                    <span
                      className="rounded-full bg-surface-card px-2 py-0.5 text-[10px] text-navy-light/50"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      Perfil nuevo
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFamilyMember(idx)}
                className="rounded-lg p-1.5 text-navy-light/30 hover:text-coral hover:bg-surface-card transition-all"
                aria-label="Eliminar familiar"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}

          {/* Inline add form */}
          {addingFamily ? (
            <div className="rounded-xl border bg-surface-card p-4 space-y-3" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-xs font-medium text-navy-light/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                Agregar familiar
              </p>

              {/* Cédula — siempre primero */}
              <Field label="Cédula">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Ej: 108470291 (opcional para menores)"
                  value={familyCedulaInput}
                  onChange={e => { onFamilyCedulaInputChange(e.target.value) }}
                  onBlur={onFamilyCedulaBlur}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </Field>

              {/* Indicador de búsqueda */}
              {familyLookup.state === 'found' && (
                <div className="flex items-center gap-2 rounded-lg bg-teal-soft/20 px-3 py-2">
                  <span className="text-teal-deep text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                    ⇄ Perfil encontrado: <strong>{familyLookup.member.first_name} {familyLookup.member.last_name}</strong> — se vinculará al agregar
                  </span>
                </div>
              )}
              {familyLookup.state === 'not-found' && familyCedulaInput.trim() && (
                <p className="text-xs text-navy-light/40 italic" style={{ fontFamily: 'var(--font-body)' }}>
                  Cédula no encontrada en el sistema — se creará un perfil nuevo
                </p>
              )}

              {/* Nombre y apellidos — siempre visibles */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre" required error={familyManualErrors.first_name}>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Nombre"
                    value={newFamilyManual.first_name}
                    onChange={e => onNewFamilyManualChange({ first_name: e.target.value })}
                    style={{ fontFamily: 'var(--font-body)' }}
                  />
                </Field>
                <Field label="Apellidos" required error={familyManualErrors.last_name}>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder={parentLastName || 'Apellidos'}
                    value={newFamilyManual.last_name}
                    onChange={e => onNewFamilyManualChange({ last_name: e.target.value })}
                    style={{ fontFamily: 'var(--font-body)' }}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Relación" required error={familyManualErrors.relation}>
                  <select
                    className={selectCls}
                    value={newFamilyManual.relation}
                    onChange={e => onNewFamilyManualChange({ relation: e.target.value })}
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    <option value="">Seleccionar…</option>
                    <option value="Cónyuge">Cónyuge</option>
                    <option value="Hijo/a">Hijo/a</option>
                    <option value="Padre">Padre</option>
                    <option value="Madre">Madre</option>
                    <option value="Hermano/a">Hermano/a</option>
                    <option value="Otro">Otro</option>
                  </select>
                </Field>
                <Field label="Fecha de nacimiento">
                  <input
                    type="date"
                    className={inputCls}
                    value={newFamilyManual.birth_date}
                    onChange={e => onNewFamilyManualChange({ birth_date: e.target.value })}
                    style={{ fontFamily: 'var(--font-body)' }}
                  />
                </Field>
              </div>

              {newFamilyManual.birth_date && !isFamilyMinor && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Correo">
                    <input
                      type="email"
                      className={inputCls}
                      placeholder="correo@…"
                      value={newFamilyManual.email}
                      onChange={e => onNewFamilyManualChange({ email: e.target.value })}
                      style={{ fontFamily: 'var(--font-body)' }}
                    />
                  </Field>
                  <PhoneInput
                    label="Teléfono"
                    value={newFamilyManual.phone}
                    onChange={val => onNewFamilyManualChange({ phone: val })}
                  />
                </div>
              )}

              {/* Botones */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onAddFamilyMember}
                  className="rounded-xl bg-coral px-4 py-2 text-sm text-white transition-all hover:bg-coral-deep active:scale-95"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {familyLookup.state === 'found' ? 'Vincular' : 'Agregar'}
                </button>
                <button
                  type="button"
                  onClick={onResetFamilyForm}
                  className="rounded-xl px-4 py-2 text-sm text-navy-light/60 transition-colors hover:bg-surface-low"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSetAddingFamily(true)}
              className="w-full rounded-xl border border-dashed py-3 text-sm text-navy-light/50 hover:border-coral/40 hover:text-coral transition-all"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              + Agregar familiar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

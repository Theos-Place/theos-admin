import { cn } from '@/lib/utils'
import { useSedes } from '@/lib/sedes'
import type { FamilyDraft } from '@/components/members/FamilyMemberModal'

type Step1Data = {
  first_name: string
  last_name: string
  cedula: string
  email: string
  phone: string
  birth_date: string
  gender: string
  marital_status: string
  province: string
  canton: string
  district: string
  profession: string
  workplace: string
  sede: string
  alergias: string
  medicamentos: string
  señas: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

function calculateAge(dateStr: string): number {
  const birth = new Date(dateStr)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

type Props = {
  data: Step1Data
  isMinor: boolean
  familyMembers: FamilyDraft[]
  sendWhatsapp: boolean
  onSendWhatsappChange: (val: boolean) => void
  sendEmail: boolean
  onSendEmailChange: (val: boolean) => void
  submitting: boolean
  submitError: string | null
  onSubmit: () => void
  draftName: (d: FamilyDraft) => string
  draftInitials: (d: FamilyDraft) => string
  draftRelation: (d: FamilyDraft) => string
}

export function NewMemberStep3({
  data,
  isMinor,
  familyMembers,
  sendWhatsapp,
  onSendWhatsappChange,
  sendEmail,
  onSendEmailChange,
  submitting,
  submitError,
  onSubmit,
  draftName: familyItemName,
  draftInitials: familyItemInitials,
  draftRelation: familyItemRelation,
}: Props) {
  const { activeSedes: SEDES } = useSedes()
  return (
    <div className="space-y-5">
      <h2
        className="text-sm font-medium text-navy"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
      >
        Confirmación
      </h2>

      {/* Main member card */}
      <div className="rounded-xl bg-surface-low p-4 flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-white text-sm"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
        >
          {((data.first_name[0] ?? '?') + (data.last_name[0] ?? '?')).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base text-navy" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            {data.first_name} {data.last_name}
          </p>
          {data.cedula && (
            <p className="text-xs text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
              {data.cedula}
            </p>
          )}
          <div className="mt-2 space-y-1">
            {data.email && (
              <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{data.email}</p>
            )}
            {data.phone && (
              <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{data.phone}</p>
            )}
            {data.birth_date && (
              <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                {calculateAge(data.birth_date)} años
                {isMinor && (
                  <span className="ml-2 rounded-full bg-teal-soft/30 px-2 py-0.5 text-[10px] text-teal-deep">Menor</span>
                )}
              </p>
            )}
            {data.province && (
              <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                {[data.district, data.canton, data.province].filter(Boolean).join(', ')}
              </p>
            )}
            {data.sede && (
              <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                Sede: {SEDES.find(s => s.id === data.sede)?.name}
              </p>
            )}
            {data.profession && (
              <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{data.profession}</p>
            )}
            {data.alergias && (
              <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                Alergias: {data.alergias}
              </p>
            )}
            {data.medicamentos && (
              <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                Medicamentos: {data.medicamentos}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Family members */}
      {familyMembers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-navy-light/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Familiares ({familyMembers.length})
          </p>
          {familyMembers.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-2.5">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs',
                  item.kind === 'linked' ? 'bg-teal-deep' : 'bg-navy'
                )}
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                {familyItemInitials(item)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                  {familyItemName(item)}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                    {familyItemRelation(item)}
                  </p>
                  {item.kind === 'linked' ? (
                    <span className="rounded-full bg-teal-soft/50 px-2 py-0.5 text-[10px] text-teal-deep" style={{ fontFamily: 'var(--font-body)' }}>
                      Perfil existente
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface-card px-2 py-0.5 text-[10px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                      Perfil nuevo
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notification checkboxes */}
      <div className="space-y-3">
        <p className="text-xs text-navy-light/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          Notificaciones de bienvenida
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-coral h-4 w-4"
            checked={sendWhatsapp}
            onChange={e => onSendWhatsappChange(e.target.checked)}
          />
          <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
            Enviar mensaje de bienvenida por WhatsApp
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-coral h-4 w-4"
            checked={sendEmail}
            onChange={e => onSendEmailChange(e.target.checked)}
          />
          <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
            Enviar mensaje de bienvenida por correo
          </span>
        </label>
      </div>

      {submitError && (
        <p className="text-[13px] text-coral text-center" style={{ fontFamily: 'var(--font-body)' }}>{submitError}</p>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="w-full rounded-full bg-coral py-3 text-sm font-medium text-white transition-all hover:bg-coral-deep active:scale-[0.98] disabled:opacity-60"
        style={{ boxShadow: 'var(--shadow-pulse)', fontFamily: 'var(--font-body)' }}
      >
        {submitting ? 'Creando perfil…' : 'Crear perfil'}
      </button>
    </div>
  )
}

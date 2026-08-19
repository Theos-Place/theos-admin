import { Phone, Mail, MapPin, User, Heart, Briefcase, Building, Lock, Edit2 } from 'lucide-react'
import type { Member } from '@/types/member'
import { formatDate } from '@/lib/format'


function calculateAge(dateStr: string): number {
  const birth = new Date(dateStr)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function InfoRow({
  icon,
  label,
  value,
  editable = true,
}: {
  icon: React.ReactNode
  label: string
  value: string
  editable?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 text-navy-light/80 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-0.5 font-display"
        >
          {label}
        </p>
        <p className="text-sm text-navy font-body">
          {value || '—'}
        </p>
      </div>
      {editable ? (
        <button
          className="rounded-lg p-1.5 text-navy-light/80 hover:text-coral hover:bg-surface-low transition-all"
          aria-label="Editar"
        >
          <Edit2 size={13} strokeWidth={1.75} />
        </button>
      ) : (
        <div className="rounded-lg p-1.5 text-navy-light/80">
          <Lock size={13} strokeWidth={1.75} />
        </div>
      )}
    </div>
  )
}

type Props = {
  member: Member
}

export function MemberPersonalTab({ member }: Props) {
  return (
    <div
      className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]"
    >
      {/* Non-editable: name + cedula */}
      <div className="mb-4 pb-4 border-b border-[var(--outline-variant)]">
        <InfoRow icon={<Lock size={15} strokeWidth={1.75} />} label="Nombre completo" value={`${member.first_name} ${member.last_name}`} editable={false} />
        <InfoRow icon={<Lock size={15} strokeWidth={1.75} />} label="Cédula" value={member.cedula ?? 'Sin cédula'} editable={false} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        {/* Contacto */}
        <div>
          <p
            className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-3 font-display"
          >
            Contacto
          </p>
          <InfoRow icon={<Phone size={15} strokeWidth={1.75} />} label="Teléfono" value={member.phone ?? '—'} />
          <InfoRow icon={<Mail size={15} strokeWidth={1.75} />} label="Correo" value={member.email ?? '—'} />
          <InfoRow icon={<MapPin size={15} strokeWidth={1.75} />} label="Dirección" value={member.address ?? '—'} />
          <InfoRow
            icon={<Phone size={15} strokeWidth={1.75} />}
            label="Contacto de emergencia"
            value={member.emergency_contact_name ?? ''}
          />
          <InfoRow
            icon={<Phone size={15} strokeWidth={1.75} />}
            label="Teléfono de emergencia"
            value={member.emergency_contact_phone ?? ''}
          />
        </div>

        {/* Datos personales */}
        <div>
          <p
            className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-3 font-display"
          >
            Datos personales
          </p>
          <InfoRow
            icon={<User size={15} strokeWidth={1.75} />}
            label="Edad"
            value={member.birth_date ? `${calculateAge(member.birth_date)} años · ${formatDate(member.birth_date)}` : '—'}
          />
          <InfoRow
            icon={<User size={15} strokeWidth={1.75} />}
            label="Género"
            value={
              member.gender === 'M'
                ? 'Masculino'
                : member.gender === 'F'
                ? 'Femenino'
                : 'No indica'
            }
          />
          <InfoRow icon={<Heart size={15} strokeWidth={1.75} />} label="Estado civil" value={member.marital_status ?? '—'} />
          <InfoRow icon={<Briefcase size={15} strokeWidth={1.75} />} label="Profesión" value={member.occupation ?? '—'} />
          <InfoRow icon={<Building size={15} strokeWidth={1.75} />} label="Lugar de trabajo" value={member.workplace ?? '—'} />
        </div>
      </div>

      {/* Salud */}
      {(member.allergies || member.medicamentos) && (
        <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]">
          <p
            className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-3 font-display"
          >
            Salud
          </p>
          <InfoRow icon={<Lock size={15} strokeWidth={1.75} />} label="Alergias" value={member.allergies ?? '—'} editable={false} />
          <InfoRow icon={<Lock size={15} strokeWidth={1.75} />} label="Medicamentos" value={member.medicamentos ?? '—'} editable={false} />
        </div>
      )}
    </div>
  )
}

// Columnas, constantes y helpers de presentación del padrón. Extraído de
// miembros/page.tsx (auditoría 2026-06: archivos gigantes). Sin estado.
import Link from 'next/link'
import { Star, UserCheck, UserX, Clock } from 'lucide-react'
import { type Member } from '@/types/member'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import type { FilterCondition } from '@/types/filters'
import { initialsFromParts, calcAge } from '@/lib/format'
import { sedeLabel } from '@/lib/sedes'
import { formatSedeRecency } from '@/lib/sede-attendance'
import { ACCOUNT_STATE_LABEL, ACCOUNT_STATE_FILTER_LABEL } from '@/lib/members/account-state'

export function initials(m: Member) {
  return initialsFromParts(m.first_name, m.last_name)
}

/** Indicador de dirigente: estrella clickeable al perfil de dirigente. Detiene
 *  la propagación para no disparar la navegación de la fila al perfil de miembro. */
export function DirigenteLink({ id }: { id: string }) {
  return (
    <Link
      href={`/estudios/dirigentes/${id}`}
      onClick={e => e.stopPropagation()}
      title="Ver perfil de dirigente"
      aria-label="Ver perfil de dirigente"
      className="inline-flex shrink-0 items-center justify-center h-5 w-5 rounded-full bg-navy/10 text-navy hover:bg-navy/15 transition-colors"
    >
      <Star size={11} strokeWidth={2} />
    </Link>
  )
}

const AVATAR_COLORS = [
  'bg-navy text-white',
  'bg-coral text-white',
  'bg-teal-deep text-white',
  'bg-navy-light text-white',
]
export function avatarColor(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

export const QUICK_CHIPS = [
  { key: 'todos',      label: 'Todos' },
  { key: 'donadores',  label: 'Donadores' },
  { key: 'servidores', label: 'Servidores' },
  { key: 'activo',     label: 'Activo (asistencia)' },
] as const

const GENDER_LABELS: Record<string, string> = {
  M: 'Masculino', F: 'Femenino', otro: 'No indica',
}

// Los textos salen de la fuente única (account-state.ts) — se re-exporta para
// no romper a quien ya importaba ACCOUNT_STATE_LABEL desde acá.
export { ACCOUNT_STATE_LABEL }

/** Badge compacto del estado de cuenta de acceso. Tres estados: sin cuenta,
 *  nunca ha entrado y activa (ver src/lib/members/account-state.ts). */
export function AccountBadge({ state }: { state: Member['account_state'] }) {
  const cfg = {
    active:        { Icon: UserCheck, cls: 'bg-teal-soft/30 text-teal-deep', label: ACCOUNT_STATE_LABEL.active },
    never_entered: { Icon: Clock,     cls: 'bg-amber-100 text-amber-700',    label: ACCOUNT_STATE_LABEL.never_entered },
    none:          { Icon: UserX,     cls: 'bg-surface-low text-navy-light/70', label: ACCOUNT_STATE_LABEL.none },
  }[state]
  return (
    <span title={`Cuenta de acceso: ${cfg.label}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium font-body ${cfg.cls}`}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  )
}

export const MEMBER_COLUMNS: ColumnDef<Member>[] = [
  {
    key: 'name', label: 'Nombre', defaultVisible: true, alwaysVisible: true,
    exportValue: m => `${m.first_name} ${m.last_name}`,
  },
  {
    key: 'cedula', label: 'Cédula', defaultVisible: true,
    exportValue: m => m.cedula ?? 'Sin cédula',
  },
  {
    key: 'age', label: 'Edad', defaultVisible: true,
    exportValue: m => m.birth_date ? String(calcAge(m.birth_date)) : '',
  },
  {
    key: 'email', label: 'Correo', defaultVisible: false,
  },
  {
    key: 'phone', label: 'Teléfono', defaultVisible: false,
  },
  {
    key: 'status', label: 'Estado', defaultVisible: false,
    exportValue: m => m.is_active ? 'Activo' : 'Inactivo',
  },
  {
    key: 'account_state', label: 'Cuenta', defaultVisible: true, exportable: true,
    render: m => <AccountBadge state={m.account_state} />,
    exportValue: m => ACCOUNT_STATE_LABEL[m.account_state],
  },
  {
    key: 'is_donor', label: 'Donador', defaultVisible: false,
    exportValue: m => m.is_donor ? 'Sí' : 'No',
  },
  {
    key: 'current_study', label: 'Nivel actual', defaultVisible: false,
    exportValue: m => m.current_study ?? '',
  },
  {
    key: 'completed_studies', label: 'Estudios completados', defaultVisible: false,
    exportValue: m => m.completed_studies?.join(', ') ?? '',
  },
  {
    key: 'service_position', label: 'Puesto de servicio', defaultVisible: false, exportable: true,
    render: m => {
      const active = m.service_history?.find(s => s.status === 'activo' && s.to === null)
      return active
        ? <span className="font-body text-[13px]">{active.position}</span>
        : <span className="text-navy-light/70 text-[12px]">—</span>
    },
    exportValue: m => m.service_history?.find(s => s.status === 'activo' && s.to === null)?.position ?? '',
  },
  {
    key: 'service_committee', label: 'Comité', defaultVisible: false, exportable: true,
    render: m => {
      const active = m.service_history?.find(s => s.status === 'activo' && s.to === null)
      return active
        ? <span className="font-body text-[13px]">{active.committee}</span>
        : <span className="text-navy-light/70 text-[12px]">—</span>
    },
    exportValue: m => m.service_history?.find(s => s.status === 'activo' && s.to === null)?.committee ?? '',
  },
  {
    key: 'service_area', label: 'Área de servicio', defaultVisible: false, exportable: true,
    render: m => {
      const active = m.service_history?.find(s => s.status === 'activo' && s.to === null)
      return active
        ? <span className="font-body text-[13px]">{active.area}</span>
        : <span className="text-navy-light/70 text-[12px]">—</span>
    },
    exportValue: m => m.service_history?.find(s => s.status === 'activo' && s.to === null)?.area ?? '',
  },
  {
    key: 'sede', label: 'Sede principal', defaultVisible: false, exportable: true,
    render: m => {
      if (!m.sede) return <span className="text-navy-light/70 text-[12px]">—</span>
      const label = sedeLabel(m.sede)
      const isInactive = m.sede_case === 'inactivo' && m.sede_last_checkin
      return (
        <span className="font-body text-[13px]">
          {label}
          {isInactive && (
            <span className="text-navy-light/70">
              {' · última actividad '}{formatSedeRecency(m.sede_last_checkin!)}
            </span>
          )}
        </span>
      )
    },
    exportValue: m => m.sede ? sedeLabel(m.sede) : '',
  },
  {
    key: 'join_date', label: 'Fecha de ingreso', defaultVisible: false,
    exportValue: m => m.join_date ? new Date(m.join_date).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '',
  },
  {
    key: 'gender', label: 'Género', defaultVisible: false,
    exportValue: m => (m.gender ? GENDER_LABELS[m.gender] : '') ?? '',
  },
  {
    key: 'occupation', label: 'Ocupación', defaultVisible: false,
  },
]

export function buildSegmentLabel(conditions: FilterCondition[], showDonors: boolean, showServers: boolean): string {
  const parts: string[] = []
  if (showDonors)  parts.push('Donadores')
  if (showServers) parts.push('Servidores')
  for (const c of conditions) {
    switch (c.type) {
      case 'study':
        parts.push(`${c.study} ${c.status === 'completed' ? 'completado' : 'en progreso'}`)
        break
      case 'attendance':
        parts.push(`Asistentes a ${c.eventType}`)
        break
      case 'service':
        parts.push(c.committee ? `Comité ${c.committee}` : c.area ? `Área ${c.area}` : 'Servicio')
        break
      case 'donor':
        parts.push(c.value === 'yes' ? 'Donadores' : 'No donadores')
        break
      case 'status':
        parts.push(c.value === 'active' ? 'Activos' : 'Inactivos')
        break
      case 'account':
        parts.push(ACCOUNT_STATE_FILTER_LABEL[c.value])
        break
      default:
        parts.push(c.type)
    }
  }
  return parts.length === 0 ? 'Todos los miembros' : parts.join(' · ')
}

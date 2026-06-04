import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { mockMembers } from '@/data/mock-members'

type Member = (typeof mockMembers)[number]

const AVATAR_COLORS = ['bg-navy', 'bg-coral', 'bg-teal-deep', 'bg-navy-light']

function avatarColor(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function initials(firstName: string, lastName: string) {
  return (firstName[0] + lastName[0]).toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
}


type Props = {
  member: Member
  onEdit: () => void
  onCommunicate: () => void
  menuOpen: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  onDeactivate: () => void
  onMerge: () => void
}

export function MemberHeader({
  member,
  onEdit,
  onCommunicate,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onDeactivate,
  onMerge,
}: Props) {
  return (
    <div
      className="rounded-2xl bg-surface-card p-5"
      style={{ boxShadow: 'var(--shadow-md)' }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white text-lg',
            avatarColor(member.id)
          )}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
        >
          {initials(member.first_name, member.last_name)}
        </div>

        {/* Name + details */}
        <div className="flex-1 min-w-0">
          <h1
            className="text-2xl text-navy leading-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            {member.first_name} {member.last_name}
          </h1>
          <p className="text-xs text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
            {member.cedula ? `Cédula: ${member.cedula}` : 'Sin cédula'}
            {member.join_date ? ` · Se unió el ${formatDate(member.join_date)}` : ''}
          </p>

          {/* Badges */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs',
                member.is_active
                  ? 'bg-teal-soft/50 text-teal-deep'
                  : 'bg-surface-low text-navy-light/50'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <span
                className={cn(
                  'mr-1.5 h-1.5 w-1.5 rounded-full',
                  member.is_active ? 'bg-teal-deep' : 'bg-navy-light/30'
                )}
              />
              {member.is_active ? 'Activo' : 'Inactivo'}
            </span>
            {member.is_donor && (
              <span
                className="rounded-full bg-coral-soft/20 px-2.5 py-0.5 text-xs text-coral"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Donador
              </span>
            )}
            {member.is_server && (
              <span
                className="rounded-full bg-teal-soft/30 px-2.5 py-0.5 text-xs text-teal-deep"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Servidor
              </span>
            )}
            {member.es_dirigente && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-0.5 text-xs text-navy"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <Star size={10} strokeWidth={2} />
                Dirigente
              </span>
            )}
            {member.roles.includes('admin') && (
              <span
                className="rounded-full bg-coral-soft/20 px-2.5 py-0.5 text-xs text-coral"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Admin
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Editar
          </button>
          <button
            onClick={onCommunicate}
            className="rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Comunicar
          </button>
          <div className="relative">
            <button
              onClick={onMenuToggle}
              className="rounded-xl border px-3 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              ···
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-surface-card py-1 z-20"
                style={{ boxShadow: 'var(--shadow-lg)', border: '1px solid var(--outline-variant)' }}
              >
                <button
                  onClick={onDeactivate}
                  className="w-full px-4 py-2 text-left text-sm text-navy-light/70 hover:bg-surface-low transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Desactivar perfil
                </button>
                <button
                  onClick={onMerge}
                  className="w-full px-4 py-2 text-left text-sm text-navy-light/70 hover:bg-surface-low transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Fusionar duplicado
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

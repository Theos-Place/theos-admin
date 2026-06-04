'use client'

import { cn } from '@/lib/utils'
import type { StudyLeader } from '@/data/mock-studies'
import { StudyTypeBadge } from './StudyTypeBadge'
import { CommitmentIcons } from './CommitmentIcons'
import { sedeLabel } from '@/lib/sedes'

const AVAILABILITY_CONFIG = {
  available: { label: 'Disponible',  className: 'bg-teal-soft/30 text-teal-deep' },
  assigned:  { label: 'Asignado',    className: 'bg-navy/10 text-navy' },
  resting:   { label: 'Descansando', className: 'bg-amber-100 text-amber-700' },
  inactive:  { label: 'Inactivo',    className: 'bg-navy/5 text-navy-light/40' },
}

const AVATAR_COLORS = [
  'bg-coral/20 text-coral',
  'bg-teal-soft/30 text-teal-deep',
  'bg-navy/10 text-navy',
]

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
}

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

interface LeaderCardProps {
  leader: StudyLeader
  onSelect?: (id: string) => void
  selected?: boolean
  compact?: boolean
}

export function LeaderCard({ leader, onSelect, selected, compact }: LeaderCardProps) {
  const avail = AVAILABILITY_CONFIG[leader.availability_status]
  const initials = getInitials(leader.member_name)
  const avatarColor = getAvatarColor(leader.member_name)

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-xl transition-colors cursor-default',
          selected ? 'bg-coral/10 ring-1 ring-coral/30' : 'hover:bg-surface-low'
        )}
        onClick={() => onSelect?.(leader.id)}
      >
        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0', avatarColor)}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>
            {leader.member_name}
          </p>
          <p className="text-[11px] text-navy-light/50">{leader.zone_preference.map(id => sedeLabel(id)).join(' · ')}</p>
        </div>
        <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', avail.className)}>
          {avail.label}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-2xl p-4 flex flex-col gap-3 transition-all',
        selected ? 'ring-2 ring-coral' : '',
        onSelect ? 'cursor-pointer hover:shadow-lg' : ''
      )}
      style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      onClick={() => onSelect?.(leader.id)}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0', avatarColor)}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-navy leading-tight truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {leader.member_name}
          </p>
          <p className="text-[12px] text-navy-light/60 mt-0.5">{leader.zone_preference.map(id => sedeLabel(id)).join(' · ')}</p>
        </div>
        <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium shrink-0', avail.className)}>
          {avail.label}
        </span>
      </div>

      {/* Qualified studies */}
      <div className="flex flex-wrap gap-1">
        {leader.qualified_studies.map(code => (
          <StudyTypeBadge key={code} code={code} size="sm" />
        ))}
      </div>

      {/* Stats */}
      <div
        className="flex items-center gap-4 text-[11px] text-navy-light/60 border-t pt-3"
        style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
      >
        <span><strong className="text-navy">{leader.stats.groups_led}</strong> grupos</span>
        <span><strong className="text-navy">{leader.stats.avg_rating.toFixed(1)}</strong> ⭐</span>
        <span><strong className="text-navy">{leader.stats.current_participants}</strong> activos</span>
      </div>

      {/* Commitments */}
      <CommitmentIcons
        donor={leader.commitments.is_donor}
        server={leader.commitments.is_server}
        charlas={leader.commitments.attends_charlas}
        size={14}
      />
    </div>
  )
}

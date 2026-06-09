'use client'

import { cn } from '@/lib/utils'
import { type AttendanceType } from '@/data/mock-events'

interface CheckinCardProps {
  member: { id: string; name: string }
  onConfirm: (type: AttendanceType) => void
  onCancel: () => void
}

const AVATAR_COLORS: Record<string, string> = {
  A: 'bg-coral text-white', B: 'bg-teal-deep text-white', C: 'bg-navy text-white',
  D: 'bg-purple-700 text-white', E: 'bg-amber-500 text-white', F: 'bg-coral text-white',
  G: 'bg-teal-deep text-white', H: 'bg-navy text-white', I: 'bg-purple-700 text-white',
  J: 'bg-amber-500 text-white', K: 'bg-coral text-white', L: 'bg-teal-deep text-white',
  M: 'bg-navy text-white', N: 'bg-purple-700 text-white', O: 'bg-amber-500 text-white',
  P: 'bg-coral text-white', Q: 'bg-teal-deep text-white', R: 'bg-navy text-white',
  S: 'bg-purple-700 text-white', T: 'bg-amber-500 text-white', U: 'bg-coral text-white',
  V: 'bg-teal-deep text-white', W: 'bg-navy text-white', X: 'bg-purple-700 text-white',
  Y: 'bg-amber-500 text-white', Z: 'bg-coral text-white',
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function getAvatarColor(name: string) {
  const first = name.charAt(0).toUpperCase()
  return AVATAR_COLORS[first] ?? 'bg-navy text-white'
}

export function CheckinCard({ member, onConfirm, onCancel }: CheckinCardProps) {
  const initials = getInitials(member.name)
  const avatarColor = getAvatarColor(member.name)

  return (
    <div
      className="rounded-2xl p-6 space-y-5 w-full max-w-sm bg-surface-card shadow-[var(--shadow-lg)]"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className={cn(
            'h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold font-display',
            avatarColor
          )}
        >
          {initials}
        </div>
        <div className="text-center">
          <p
            className="text-lg font-bold text-navy font-display"
          >
            {member.name}
          </p>
          <p className="text-xs text-navy-light/50 font-body">
            ID {member.id}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onConfirm('participant')}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-teal-deep px-5 py-3 text-sm font-medium text-white hover:opacity-90 transition-all duration-150 font-body"
        >
          <span>✓</span>
          Participante
        </button>
        <button
          onClick={() => onConfirm('server')}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-medium text-white hover:bg-coral-deep transition-all duration-150 font-body"
        >
          <span>⚡</span>
          Servidor
        </button>
        <button
          onClick={onCancel}
          className="w-full rounded-full border px-5 py-2.5 text-sm text-navy-light/60 hover:bg-surface-low transition-all duration-150 border-[var(--outline-variant)] font-body"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

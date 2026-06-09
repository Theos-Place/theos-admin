'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { type Member } from '@/data/mock-members'
import { sedeLabel } from '@/lib/sedes'

type Props = {
  member: Member
  onDismiss: () => void
}

export function DuplicateWarning({ member, onDismiss }: Props) {
  const initials = (member.first_name[0] + member.last_name[0]).toUpperCase()

  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" strokeWidth={1.75} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-amber-800 font-display">
            Ya existe un miembro con esta cédula
          </p>

          <div className="mt-2 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs text-amber-800 font-display font-extrabold"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-amber-900 font-body">
                {member.first_name} {member.last_name}
              </p>
              <p className="text-xs text-amber-600 font-body">
                {member.is_active ? 'Activo' : 'Inactivo'} · {sedeLabel(member.sede)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/miembros/${member.id}`}
              className="rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-300 font-body"
            >
              Ver perfil existente
            </Link>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg px-3 py-1.5 text-xs text-amber-600 transition-colors hover:bg-amber-100 font-body"
            >
              Ignorar y continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

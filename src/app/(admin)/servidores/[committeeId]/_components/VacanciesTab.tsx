'use client'

import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { type Vacancy } from '@/types/server'
import { cn } from '@/lib/utils'

type VacancyStatus = 'draft' | 'published' | 'filled' | 'closed'

type Props = {
  committeeId: string
  vacancies: Vacancy[]
}

const STATUS_COLORS: Record<VacancyStatus, string> = {
  draft: 'bg-navy-light/10 text-navy-light/60',
  published: 'bg-teal-deep/10 text-teal-deep',
  filled: 'bg-navy/10 text-navy',
  closed: 'bg-coral/10 text-coral',
}

const STATUS_LABELS: Record<VacancyStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  filled: 'Ocupada',
  closed: 'Cerrada',
}

export function VacanciesTab({ committeeId, vacancies }: Props) {
  return (
    <div className="py-4 px-[22px] flex flex-col gap-2.5">
      <div className="flex justify-end">
        <Link
          href={`/servidores/vacantes/nueva?comite=${committeeId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors font-body"
        >
          <Plus size={13} />
          Solicitar nuevo puesto
        </Link>
      </div>

      {vacancies.length === 0 && (
        <div className="rounded-xl bg-surface-low">
          <EmptyState icon={Users} title="No hay puestos de servicio para este comité" />
        </div>
      )}

      {vacancies.map(v => (
        <Link
          key={v.id}
          href={`/servidores/vacantes/${v.id}`}
          className="block rounded-2xl px-5 py-4 hover:shadow-lg transition-all duration-150 bg-surface-card shadow-[var(--shadow-md)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-navy font-display">
                {v.title}
              </p>
              <p className="text-[12px] text-navy-light/60 font-body">
                {v.position}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-navy-light/60 font-mono">
                {v.slots_filled}/{v.slots_total} cupos
              </span>
              <span
                className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold font-display', STATUS_COLORS[v.status])}
              >
                {STATUS_LABELS[v.status]}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

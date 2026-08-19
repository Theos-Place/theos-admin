'use client'

import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { type Vacancy, type VacancyStatus } from '@/types/server'
import { VACANCY_STATE_BADGE, VACANCY_STATE_LABEL } from '@/lib/servers/vacancy-states'
import { cn } from '@/lib/utils'

type Props = {
  committeeId: string
  vacancies: Vacancy[]
}

const STATUS_COLORS: Record<VacancyStatus, string> = VACANCY_STATE_BADGE
const STATUS_LABELS: Record<VacancyStatus, string> = VACANCY_STATE_LABEL

export function VacanciesTab({ committeeId, vacancies }: Props) {
  return (
    <div className="py-4 px-[22px] flex flex-col gap-2.5">
      <div className="flex justify-end">
        <Link
          href={`/servidores/vacantes/solicitar?comite=${committeeId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] text-white hover:bg-coral-deep transition-colors font-body"
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
              <p className="text-[13px] text-navy-light/80 font-body">
                {v.position}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[13px] text-navy-light/80 font-mono">
                {v.slots_filled}/{v.slots_total} cupos
              </span>
              <span
                className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', STATUS_COLORS[v.status])}
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

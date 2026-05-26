'use client'

import type { Employee, VacationRecordType } from '@/data/mock-employees'
import { VacationTracker } from '@/components/employees/VacationTracker'
import { cn } from '@/lib/utils'
import { Calendar, Clock, Plus } from 'lucide-react'

const VACATION_TYPE_LABELS: Record<VacationRecordType, string> = {
  vacaciones:          'Vacaciones',
  permiso_con_goce:    'Permiso con goce',
  permiso_sin_goce:    'Permiso sin goce',
  incapacidad:         'Incapacidad',
}

const STATUS_COLORS: Record<string, string> = {
  aprobado:  'bg-teal-soft/30 text-teal-deep',
  pendiente: 'bg-amber-100 text-amber-700',
  rechazado: 'bg-coral/10 text-coral',
}

function calcularDiasHabiles(desde: string, hasta: string): number {
  const start = new Date(desde + 'T00:00:00')
  const end   = new Date(hasta  + 'T00:00:00')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

interface TabVacacionesProps {
  employee: Employee
  vacDiasDisponibles: number
  onOpenVacModal: () => void
}

export function TabVacaciones({ employee, vacDiasDisponibles, onOpenVacModal }: TabVacacionesProps) {
  if (employee.contract_type === 'servicios_profesionales') {
    return (
      <div className="space-y-5">
        <div className="rounded-xl py-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface-low)' }}>
          <Clock size={24} className="text-navy-light/30" />
          <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
            Servicios profesionales no aplica para control de vacaciones.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Balance de vacaciones</p>
          <p className="text-[13px] text-navy" style={{ fontFamily: 'var(--font-body)' }}>
            <span className="font-semibold">{vacDiasDisponibles}</span> días disponibles de <span className="font-semibold">{employee.vacation_days_total}</span>
          </p>
        </div>
        {employee.status === 'active' && (
          <button
            type="button"
            onClick={onOpenVacModal}
            className="flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Plus size={13} />
            Registrar solicitud
          </button>
        )}
      </div>

      <VacationTracker
        total={employee.vacation_days_total}
        used={employee.vacation_days_used}
      />

      {employee.vacation_records.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Registros</p>
          {employee.vacation_records.map(v => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-xl p-3"
              style={{ background: 'var(--surface-low)' }}
            >
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar size={13} className="text-navy-light/50" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                    {VACATION_TYPE_LABELS[v.type]}
                  </p>
                  <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                    {new Date(v.start_date + 'T00:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                    {' — '}
                    {new Date(v.end_date + 'T00:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {calcularDiasHabiles(v.start_date, v.end_date)} días hábiles
                  </p>
                  {v.notes && (
                    <p className="text-[11px] text-navy-light/40 italic" style={{ fontFamily: 'var(--font-body)' }}>{v.notes}</p>
                  )}
                </div>
              </div>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0', STATUS_COLORS[v.status])} style={{ fontFamily: 'var(--font-display)' }}>
                {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-navy-light/40 py-6" style={{ fontFamily: 'var(--font-body)' }}>
          Sin registros de vacaciones.
        </p>
      )}
    </div>
  )
}

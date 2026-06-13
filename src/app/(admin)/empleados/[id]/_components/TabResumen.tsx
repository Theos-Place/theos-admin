'use client'

import type { Employee } from '@/data/mock-employees'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { SalaryBadge } from '@/components/employees/SalaryBadge'
import { AlertTriangle } from 'lucide-react'

interface TabResumenProps {
  employee: Employee
  vacDiasDisponibles: number
}

export function TabResumen({ employee, vacDiasDisponibles }: TabResumenProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 space-y-1 bg-surface-low">
          <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-display">Salario actual</p>
          <SalaryBadge amount={employee.current_salary} size="md" />
        </div>
        <div className="rounded-xl p-4 space-y-1 bg-surface-low">
          <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-display">Tipo de contrato</p>
          <ContractTypeBadge type={employee.contract_type} size="md" />
        </div>
        <div className="rounded-xl p-4 space-y-1 bg-surface-low">
          <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-display">Vacaciones</p>
          <p className="text-sm font-semibold text-navy font-display">
            {employee.contract_type === 'planilla' ? `${vacDiasDisponibles} días disponibles` : 'No aplica'}
          </p>
        </div>
      </div>

      {employee.notes && (
        <div>
          <p className="text-[10px] uppercase tracking-widests text-navy-light/60 mb-2 font-display">Notas internas</p>
          <p className="text-sm text-navy-light/70 leading-relaxed font-body">
            {employee.notes}
          </p>
        </div>
      )}

      {employee.vacation_records.filter(v => v.status === 'pendiente').length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700 font-body">
            Hay {employee.vacation_records.filter(v => v.status === 'pendiente').length} solicitud(es) de vacaciones pendiente(s) de aprobación.
          </p>
        </div>
      )}
    </div>
  )
}

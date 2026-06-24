'use client'

import type { Employee } from '@/types/employee'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { SalaryTimeline } from '@/components/employees/SalaryTimeline'
import { TrendingUp, Briefcase } from 'lucide-react'

interface TabContratoProps {
  employee: Employee
  onOpenRaiseModal: () => void
}

export function TabContrato({ employee, onOpenRaiseModal }: TabContratoProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Historial salarial</p>
        {employee.status === 'active' && (
          <button
            type="button"
            onClick={onOpenRaiseModal}
            className="flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors font-body"
          >
            <TrendingUp size={13} />
            Registrar ajuste
          </button>
        )}
      </div>
      <SalaryTimeline
        initialSalary={employee.current_salary}
        startDate={employee.start_date}
        history={employee.salary_history}
      />

      {employee.position_history.length > 0 && (
        <div className="pt-4 border-t border-[var(--outline-variant)] space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Historial de puestos</p>
          {employee.position_history.map((p, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl p-3 bg-surface-low">
              <div className="h-7 w-7 rounded-lg bg-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                <Briefcase size={13} className="text-navy-light/60" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-navy font-body">{p.position_name}</p>
                <p className="text-[11px] text-navy-light/60 font-body">
                  {new Date(p.start_date + 'T00:00:00').toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })}
                  {' — '}
                  {p.end_date
                    ? new Date(p.end_date + 'T00:00:00').toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })
                    : 'hoy'}
                </p>
              </div>
              <ContractTypeBadge type={p.contract_type} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

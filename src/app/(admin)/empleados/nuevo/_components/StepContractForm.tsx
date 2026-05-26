import { AlertTriangle } from 'lucide-react'
import { type ContractType } from '@/data/mock-employees'
import { type PaidPosition } from '@/types/employee'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { SalaryBadge } from '@/components/employees/SalaryBadge'
import { cn } from '@/lib/utils'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

interface StepContractFormProps {
  activePositions: PaidPosition[]
  positionId: string
  onPositionChange: (id: string) => void
  selectedPosition: PaidPosition | null
  contractType: ContractType
  onContractTypeChange: (t: ContractType) => void
  salary: string
  onSalaryChange: (v: string) => void
  salaryOutOfRange: boolean
  startDate: string
  onStartDateChange: (v: string) => void
  notes: string
  onNotesChange: (v: string) => void
}

export function StepContractForm({
  activePositions,
  positionId,
  onPositionChange,
  selectedPosition,
  contractType,
  onContractTypeChange,
  salary,
  onSalaryChange,
  salaryOutOfRange,
  startDate,
  onStartDateChange,
  notes,
  onNotesChange,
}: StepContractFormProps) {
  return (
    <div
      className="rounded-2xl p-5 space-y-5"
      style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
    >
      <p
        className="text-[11px] tracking-widths uppercase text-navy-light/40"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Paso 2 — Definir contrato
      </p>

      {/* Puesto */}
      <div className="space-y-1">
        <label
          className="text-[11px] tracking-widests uppercase text-navy-light/40"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Puesto <span className="text-coral">*</span>
        </label>
        <select
          className={inputCls}
          style={{ fontFamily: 'var(--font-body)' }}
          value={positionId}
          onChange={e => onPositionChange(e.target.value)}
        >
          <option value="">Seleccionar puesto...</option>
          {activePositions.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.committee_name}
            </option>
          ))}
        </select>
        {selectedPosition && (
          <div className="flex items-center gap-2 pt-1">
            <ContractTypeBadge type={selectedPosition.contract_type} size="sm" />
            <span className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              Rango aprobado:
            </span>
            <SalaryBadge amount={selectedPosition.salary_min} size="sm" />
            <span className="text-[11px] text-navy-light/30">—</span>
            <SalaryBadge amount={selectedPosition.salary_max} size="sm" />
          </div>
        )}
      </div>

      {/* Tipo de contrato */}
      <div className="space-y-2">
        <label
          className="text-[11px] tracking-widests uppercase text-navy-light/40"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Tipo de contrato
        </label>
        <div className="flex gap-4">
          {([['planilla', 'Planilla'], ['servicios_profesionales', 'Servicios profesionales']] as const).map(
            ([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="accent-coral"
                  value={val}
                  checked={contractType === val}
                  onChange={() => onContractTypeChange(val)}
                />
                <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                  {label}
                </span>
              </label>
            )
          )}
        </div>
      </div>

      {/* Salario */}
      <div className="space-y-1">
        <label
          className="text-[11px] tracking-widests uppercase text-navy-light/40"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Salario mensual <span className="text-coral">*</span>
        </label>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/50"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            ₡
          </span>
          <input
            type="number"
            className={cn(inputCls, 'pl-7')}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="0"
            value={salary}
            onChange={e => onSalaryChange(e.target.value)}
          />
        </div>
        {salaryOutOfRange && selectedPosition && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-1">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700" style={{ fontFamily: 'var(--font-body)' }}>
              El salario está fuera del rango aprobado para este puesto (₡
              {selectedPosition.salary_min.toLocaleString('es-CR')} — ₡
              {selectedPosition.salary_max.toLocaleString('es-CR')}). Se requiere aprobación adicional.
            </p>
          </div>
        )}
      </div>

      {/* Fecha de inicio */}
      <div className="space-y-1">
        <label
          className="text-[11px] tracking-widests uppercase text-navy-light/40"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Fecha de inicio <span className="text-coral">*</span>
        </label>
        <input
          type="date"
          className={inputCls}
          style={{ fontFamily: 'var(--font-body)' }}
          value={startDate}
          onChange={e => onStartDateChange(e.target.value)}
        />
      </div>

      {/* Notas */}
      <div className="space-y-1">
        <label
          className="text-[11px] tracking-widests uppercase text-navy-light/40"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Notas internas
        </label>
        <textarea
          className={cn(inputCls, 'resize-none')}
          style={{ fontFamily: 'var(--font-body)' }}
          rows={3}
          placeholder="Observaciones, acuerdos especiales, etc."
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
        />
      </div>
    </div>
  )
}

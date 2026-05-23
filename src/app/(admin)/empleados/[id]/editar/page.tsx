'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MOCK_EMPLOYEES, MOCK_PAID_POSITIONS, type ContractType } from '@/data/mock-employees'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

export default function EditarEmpleadoPage() {
  const { id } = useParams<{ id: string }>()
  const employee = useMemo(() => MOCK_EMPLOYEES.find(e => e.id === id), [id])
  const activePositions = useMemo(() => MOCK_PAID_POSITIONS.filter(p => p.is_active), [])

  const [positionId, setPositionId]         = useState(employee?.position_id ?? '')
  const [contractType, setContractType]     = useState<ContractType>(employee?.contract_type ?? 'planilla')
  const [email, setEmail]                   = useState(employee?.member_email ?? '')
  const [notes, setNotes]                   = useState(employee?.notes ?? '')
  const [vacationDays, setVacationDays]     = useState(String(employee?.vacation_days_total ?? 15))
  const [saved, setSaved]                   = useState(false)

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Empleado no encontrado.
        </p>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Cambios guardados
          </p>
          <Link
            href={`/empleados/${id}`}
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Ver expediente
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 rounded-2xl px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/empleados/${id}`}
            className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={16} />
            {employee.member_name}
          </Link>
          <span className="text-navy-light/20">|</span>
          <span className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Editar
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/empleados/${id}`}
            className="rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Guardar cambios
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        {/* Info no editable */}
        <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface-low)' }}>
          <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Persona</p>
          <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>{employee.member_name}</p>
          <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
            Inicio: {new Date(employee.start_date + 'T00:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Correo de contacto
          </label>
          <input
            type="email"
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        {/* Puesto */}
        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Puesto
          </label>
          <select
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            value={positionId}
            onChange={e => setPositionId(e.target.value)}
          >
            {activePositions.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.committee_name}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de contrato */}
        <div className="space-y-2">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Tipo de contrato
          </label>
          <div className="flex gap-4">
            {([['planilla', 'Planilla'], ['servicios_profesionales', 'Servicios profesionales']] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="accent-coral"
                  value={val}
                  checked={contractType === val}
                  onChange={() => setContractType(val)}
                />
                <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Días de vacaciones (solo planilla) */}
        {contractType === 'planilla' && (
          <div className="space-y-1">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Días de vacaciones por año
            </label>
            <input
              type="number"
              min="0"
              max="30"
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={vacationDays}
              onChange={e => setVacationDays(e.target.value)}
            />
          </div>
        )}

        {/* Notas */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Notas internas
            </label>
            <span className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-mono)' }}>
              {notes.length}/500
            </span>
          </div>
          <textarea
            className={cn(inputCls, 'resize-none')}
            style={{ fontFamily: 'var(--font-body)' }}
            rows={4}
            maxLength={500}
            placeholder="Observaciones, acuerdos, notas de evaluación..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

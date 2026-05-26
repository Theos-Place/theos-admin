'use client'

import Link from 'next/link'
import type { Employee } from '@/data/mock-employees'
import { cn } from '@/lib/utils'

function calcularAntiguedad(startDate: string): string {
  const inicio = new Date(startDate)
  const hoy = new Date()
  const meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth())
  if (meses < 12) return `${meses} meses`
  const años = Math.floor(meses / 12)
  const mesesRest = meses % 12
  return mesesRest > 0
    ? `${años} año${años > 1 ? 's' : ''} y ${mesesRest} meses`
    : `${años} año${años > 1 ? 's' : ''}`
}

interface EmployeeHeaderProps {
  employee: Employee
  id: string
  onTerminate: () => void
}

export function EmployeeHeader({ employee, id, onTerminate }: EmployeeHeaderProps) {
  return (
    <div className="ph">
      <div className="ph-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className={cn('h-12 w-12 rounded-full flex items-center justify-center shrink-0', employee.status === 'active' ? 'bg-navy' : 'bg-navy-light/20')}>
            <span className={cn('text-sm font-bold', employee.status === 'active' ? 'text-white' : 'text-navy-light/50')} style={{ fontFamily: 'var(--font-display)' }}>
              {employee.member_initials}
            </span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="ptitle">{employee.member_name}</div>
              {employee.status === 'inactive' && (
                <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-semibold text-coral" style={{ fontFamily: 'var(--font-display)' }}>Inactivo</span>
              )}
            </div>
            <div className="psub">{employee.position_name} · {employee.member_email}</div>
          </div>
        </div>
        <div className="ph-actions">
          <Link href={`/empleados/${id}/editar`} className="btn btn-ghost btn-sm">Editar</Link>
          {employee.status === 'active' && (
            <button type="button" onClick={onTerminate} className="btn btn-ghost btn-sm" style={{ color: 'var(--brand-coral)', borderColor: 'rgba(239,85,84,0.3)' }}>Dar de baja</button>
          )}
        </div>
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--outline-variant)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 16 }}>
        {[
          { label: 'Comité',     value: employee.committee_name },
          { label: 'Área',       value: employee.area },
          { label: 'Desde',      value: new Date(employee.start_date + 'T00:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' }) },
          { label: 'Antigüedad', value: calcularAntiguedad(employee.start_date) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
            <p className="text-[13px] text-navy mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

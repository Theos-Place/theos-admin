'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useEmployees } from '@/hooks/useEmployees'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { SalaryBadge } from '@/components/employees/SalaryBadge'
import { ChevronLeft, Lock } from 'lucide-react'

export default function PuestoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { employees, positions } = useEmployees()
  const position = useMemo(() => positions.find(p => p.id === id), [positions, id])
  const assigned = useMemo(
    () => employees.find(e => e.position_id === id && e.status === 'active'),
    [employees, id]
  )

  if (!position) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/60 font-body">
          Puesto no encontrado.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        href="/empleados/puestos"
        className="inline-flex items-center gap-1.5 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={15} />
        Puestos
      </Link>

      {/* Header */}
      <div
        className="rounded-2xl px-6 py-5 space-y-3 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[10px] font-semibold text-navy-light/60 font-display"
              >
                {position.committee_name}
              </span>
              <ContractTypeBadge type={position.contract_type} size="sm" />
              {!position.is_active && (
                <span
                  className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-semibold text-coral font-display"
                >
                  Inactivo
                </span>
              )}
            </div>
            <h1
              className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
            >
              {position.name}
            </h1>
          </div>
          <Link
            href={`/empleados/puestos/${id}/editar`}
            className="shrink-0 rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Editar
          </Link>
        </div>

        <p className="text-sm text-navy-light/70 leading-relaxed font-body">
          {position.description}
        </p>
      </div>

      {/* Salary range */}
      <div
        className="rounded-2xl p-5 space-y-3 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center gap-2">
          <p className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display">
            Rango salarial aprobado
          </p>
          <Lock size={11} className="text-navy-light/60" />
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <p className="text-[10px] text-navy-light/60 font-display">Mínimo</p>
            <SalaryBadge amount={position.salary_min} size="md" />
          </div>
          <span className="text-navy-light/60 text-lg">—</span>
          <div className="space-y-0.5">
            <p className="text-[10px] text-navy-light/60 font-display">Máximo</p>
            <SalaryBadge amount={position.salary_max} size="md" />
          </div>
        </div>
      </div>

      {/* Assigned employee */}
      <div
        className="rounded-2xl p-5 space-y-3 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <p className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display">
          Persona asignada
        </p>
        {assigned ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-navy flex items-center justify-center">
                <span className="text-[11px] font-bold text-white font-display">
                  {assigned.member_initials}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy font-display">
                  {assigned.member_name}
                </p>
                <p className="truncate text-[12px] text-navy-light/60 font-body">
                  {assigned.member_email}
                </p>
              </div>
            </div>
            <Link
              href={`/empleados/${assigned.id}`}
              className="shrink-0 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              Ver expediente
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span
              className="rounded-full bg-navy-light/10 px-3 py-1 text-[12px] text-navy-light/60 font-display"
            >
              Sin asignar
            </span>
            <Link
              href="/empleados/nuevo"
              className="rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors font-body"
            >
              Contratar empleado
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

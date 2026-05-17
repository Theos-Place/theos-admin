'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { MOCK_PAID_POSITIONS, MOCK_EMPLOYEES } from '@/data/mock-employees'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { SalaryBadge } from '@/components/employees/SalaryBadge'
import { AREAS } from '@/data/mock-committees'
import { cn } from '@/lib/utils'
import { Plus, Lock } from 'lucide-react'

export default function PuestosPage() {
  const [areaFilter, setAreaFilter] = useState('all')

  const areaOptions = [
    { key: 'all', label: 'Todas las áreas' },
    ...AREAS.map(a => ({ key: a.name, label: a.name })),
  ]

  const assignedByPosition = useMemo(() => {
    const map: Record<string, typeof MOCK_EMPLOYEES[0] | undefined> = {}
    MOCK_EMPLOYEES.filter(e => e.status === 'active').forEach(e => {
      map[e.position_id] = e
    })
    return map
  }, [])

  const grouped = useMemo(() => {
    return AREAS.map(area => ({
      ...area,
      positions: MOCK_PAID_POSITIONS.filter(
        p => p.area === area.name && (areaFilter === 'all' || p.area === areaFilter)
      ),
    })).filter(a => a.positions.length > 0)
  }, [areaFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl bg-navy px-6 py-5 flex items-start justify-between gap-4"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div>
          <h1
            className="text-2xl text-white"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Puestos pagados
          </h1>
          <p className="mt-1 text-sm text-white/50" style={{ fontFamily: 'var(--font-body)' }}>
            Roles remunerados definidos en la organización
          </p>
        </div>
        <Link
          href="/empleados/puestos/nuevo"
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 shrink-0"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Plus size={14} />
          Nuevo puesto
        </Link>
      </div>

      {/* Confidentiality note */}
      <div
        className="flex items-center gap-2.5 rounded-xl px-4 py-3"
        style={{ background: 'var(--surface-low)' }}
      >
        <Lock size={13} className="text-navy-light/40 shrink-0" />
        <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Los rangos salariales son confidenciales — solo visibles para Administración y Dirección.
        </p>
      </div>

      {/* Area filter */}
      <select
        className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 w-full max-w-xs"
        style={{ fontFamily: 'var(--font-body)' }}
        value={areaFilter}
        onChange={e => setAreaFilter(e.target.value)}
      >
        {areaOptions.map(o => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>

      {/* Cards by area */}
      <div className="space-y-8">
        {grouped.map(area => (
          <div key={area.code} className="space-y-3">
            <div className="flex items-center gap-3">
              <p
                className="text-[11px] tracking-widest uppercase font-semibold text-navy-light/50"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {area.name}
              </p>
              <div className="flex-1 h-px" style={{ background: 'var(--outline-variant)' }} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {area.positions.map(pos => {
                const assigned = assignedByPosition[pos.id]
                return (
                  <div
                    key={pos.id}
                    className="rounded-2xl p-5 space-y-4"
                    style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <p
                          className="text-base font-bold text-navy leading-snug"
                          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
                        >
                          {pos.name}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold text-navy-light/60"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            {pos.committee_name}
                          </span>
                          <ContractTypeBadge type={pos.contract_type} size="sm" />
                          {!pos.is_active && (
                            <span
                              className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-semibold text-coral"
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              Inactivo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Salary range */}
                    <div className="space-y-0.5">
                      <p className="text-[10px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                        Rango salarial
                      </p>
                      <div className="flex items-center gap-2">
                        <SalaryBadge amount={pos.salary_min} size="sm" />
                        <span className="text-[11px] text-navy-light/30">—</span>
                        <SalaryBadge amount={pos.salary_max} size="sm" />
                      </div>
                    </div>

                    {/* Assigned employee */}
                    <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
                      {assigned ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center">
                            <span className="text-[9px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                              {assigned.member_initials}
                            </span>
                          </div>
                          <span className="text-[12px] text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                            {assigned.member_name}
                          </span>
                        </div>
                      ) : (
                        <span
                          className="rounded-full bg-navy-light/10 px-2.5 py-0.5 text-[10px] text-navy-light/40"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          Sin asignar
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/empleados/puestos/${pos.id}`}
                          className="rounded-full border px-3 py-1 text-[11px] text-navy-light hover:bg-surface-low transition-colors"
                          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                        >
                          Ver detalle
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

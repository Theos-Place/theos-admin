'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MOCK_EMPLOYEES, type ContractType } from '@/data/mock-employees'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

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

type FilterKey = 'all' | 'planilla' | 'servicios_profesionales' | 'inactive'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',                      label: 'Todos' },
  { key: 'planilla',                 label: 'Planilla' },
  { key: 'servicios_profesionales',  label: 'Servicios profesionales' },
  { key: 'inactive',                 label: 'Inactivos' },
]

export default function EmpleadosPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [historyOpen, setHistoryOpen] = useState(false)

  const active   = MOCK_EMPLOYEES.filter(e => e.status === 'active')
  const inactive = MOCK_EMPLOYEES.filter(e => e.status === 'inactive')
  const planilla = active.filter(e => e.contract_type === 'planilla').length
  const servicios = active.filter(e => e.contract_type === 'servicios_profesionales').length
  const pendingVacations = MOCK_EMPLOYEES.reduce(
    (sum, e) => sum + e.vacation_records.filter(r => r.status === 'pendiente').length, 0
  )

  const displayed = useMemo(() => {
    if (filter === 'inactive') return inactive
    return active.filter(e => {
      if (filter === 'all') return true
      return e.contract_type === filter
    })
  }, [filter, active, inactive])

  const TABLE_HEADERS = ['Empleado', 'Puesto', 'Comité', 'Tipo', 'Desde', '']

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
            Empleados
          </h1>
          <p className="mt-1 text-sm text-white/50" style={{ fontFamily: 'var(--font-body)' }}>
            Personal remunerado de Theos Place
          </p>
        </div>
        {can('empleados', 'create') && (
          <Link
            href="/empleados/nuevo"
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 shrink-0"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Plus size={14} />
            Contratar empleado
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Empleados activos',      value: active.length,   color: 'text-navy' },
          { label: 'En planilla',            value: planilla,         color: 'text-navy' },
          { label: 'Servicios profesionales',value: servicios,        color: 'text-teal-deep' },
          { label: 'Vacaciones pendientes',  value: pendingVacations, color: pendingVacations > 0 ? 'text-coral' : 'text-navy' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <p className="text-[10px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              {label}
            </p>
            <p className={cn('mt-2 text-4xl font-extrabold tabular-nums', color)} style={{ fontFamily: 'var(--font-display)' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all duration-150',
              filter === f.key
                ? 'bg-navy text-white border-navy'
                : 'text-navy-light/60 hover:text-navy hover:bg-surface-low border-transparent'
            )}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {TABLE_HEADERS.map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.filter(e => filter !== 'inactive' ? e.status === 'active' : e.status === 'inactive').map((emp, idx) => (
                <tr
                  key={emp.id}
                  onClick={() => router.push(`/empleados/${emp.id}`)}
                  className={cn(
                    'hover:bg-navy/5 transition-colors cursor-pointer',
                    idx % 2 === 1 ? 'bg-surface-low/40' : ''
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-navy flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                          {emp.member_initials}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                          {emp.member_name}
                        </p>
                        <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                          {emp.member_email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                    {emp.position_name}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                    {emp.committee_name}
                  </td>
                  <td className="px-4 py-3">
                    <ContractTypeBadge type={emp.contract_type} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-navy-light/60 whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                      {new Date(emp.start_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                      {calcularAntiguedad(emp.start_date)}
                    </p>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Link
                      href={`/empleados/${emp.id}`}
                      className="rounded-lg px-2.5 py-1 text-[11px] text-navy-light border hover:bg-surface-low transition-colors"
                      style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                    >
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {displayed.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              No hay empleados con ese filtro.
            </p>
          </div>
        )}
      </div>

      {/* Historial colapsable */}
      {filter !== 'inactive' && inactive.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
        >
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-low transition-colors"
          >
            <span className="text-sm font-semibold text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>
              Historial de personal ({inactive.length})
            </span>
            {historyOpen
              ? <ChevronUp size={16} className="text-navy-light/40" />
              : <ChevronDown size={16} className="text-navy-light/40" />
            }
          </button>

          {historyOpen && (
            <div className="border-t" style={{ borderColor: 'var(--outline-variant)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Empleado', 'Puesto', 'Comité', 'Tipo', 'Período', ''].map(h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/40"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inactive.map((emp, idx) => (
                      <tr
                        key={emp.id}
                        onClick={() => router.push(`/empleados/${emp.id}`)}
                        className={cn(
                          'hover:bg-navy/5 transition-colors cursor-pointer opacity-60',
                          idx % 2 === 1 ? 'bg-surface-low/40' : ''
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-navy-light/20 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-navy-light/50" style={{ fontFamily: 'var(--font-display)' }}>
                                {emp.member_initials}
                              </span>
                            </div>
                            <p className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                              {emp.member_name}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                          {emp.position_name}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                          {emp.committee_name}
                        </td>
                        <td className="px-4 py-3">
                          <ContractTypeBadge type={emp.contract_type} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-[12px] text-navy-light/50 whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                          {new Date(emp.start_date).toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })}
                          {' — '}
                          {emp.end_date
                            ? new Date(emp.end_date).toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <Link
                            href={`/empleados/${emp.id}`}
                            className="rounded-lg px-2.5 py-1 text-[11px] text-navy-light/50 border hover:bg-surface-low transition-colors"
                            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                          >
                            →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

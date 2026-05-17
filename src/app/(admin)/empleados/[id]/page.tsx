'use client'

import { useMemo, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MOCK_EMPLOYEES, type Employee, type VacationRecordType } from '@/data/mock-employees'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { SalaryBadge } from '@/components/employees/SalaryBadge'
import { SalaryTimeline } from '@/components/employees/SalaryTimeline'
import { VacationTracker } from '@/components/employees/VacationTracker'
import { DocumentCard } from '@/components/employees/DocumentCard'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  FileText,
  CreditCard,
  ShieldCheck,
  File,
  TrendingUp,
  AlertTriangle,
  Upload,
  Check,
  X,
  Plus,
  Calendar,
  Clock,
  DollarSign,
  History,
  Briefcase,
  User,
  AlertOctagon,
} from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

type Tab = 'resumen' | 'contrato' | 'vacaciones' | 'documentos' | 'historial'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'resumen',    label: 'Resumen',    icon: User      },
  { key: 'contrato',   label: 'Contrato',   icon: Briefcase },
  { key: 'vacaciones', label: 'Vacaciones', icon: Calendar  },
  { key: 'documentos', label: 'Documentos', icon: FileText  },
  { key: 'historial',  label: 'Historial',  icon: History   },
]

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

export default function EmpleadoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const employee = useMemo(() => MOCK_EMPLOYEES.find(e => e.id === id), [id])

  const [tab, setTab] = useState<Tab>('resumen')

  // Salary raise modal
  const [showRaiseModal, setShowRaiseModal]         = useState(false)
  const [raiseAmount, setRaiseAmount]               = useState('')
  const [raiseReason, setRaiseReason]               = useState('')
  const [raiseDate, setRaiseDate]                   = useState('')
  const [raiseSaved, setRaiseSaved]                 = useState(false)

  // Terminate modal
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [terminateConfirm, setTerminateConfirm]     = useState('')
  const [terminateDate, setTerminateDate]           = useState('')
  const [terminateReason, setTerminateReason]       = useState('')

  // Vacation request modal
  const [showVacModal, setShowVacModal]             = useState(false)
  const [vacType, setVacType]                       = useState<VacationRecordType>('vacaciones')
  const [vacFrom, setVacFrom]                       = useState('')
  const [vacTo, setVacTo]                           = useState('')
  const [vacNotes, setVacNotes]                     = useState('')
  const [vacSaved, setVacSaved]                     = useState(false)

  // Documents
  const [extraDocs, setExtraDocs]                   = useState<{ name: string; type: 'otro' }[]>([])
  const uploadRef = useRef<HTMLInputElement | null>(null)

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Empleado no encontrado.
        </p>
      </div>
    )
  }


  const vacDiasDisponibles = employee.vacation_days_total - employee.vacation_days_used
  const diasHabilesModal   = vacFrom && vacTo ? calcularDiasHabiles(vacFrom, vacTo) : 0

  const currentSalary = employee.current_salary

  function canRaise() {
    return raiseAmount !== '' && parseFloat(raiseAmount) > currentSalary && raiseDate !== ''
  }

  const allDocs = [
    ...employee.documents,
    ...extraDocs.map((d, i) => ({
      id: `extra-${i}`,
      name: d.name,
      type: 'otro' as const,
      uploaded_at: new Date().toISOString().slice(0, 10),
      url: '#',
    })),
  ]

  // Full timeline items
  const timeline = [
    ...employee.salary_history.map(s => ({
      date: s.date,
      type: 'salary' as const,
      label: `Ajuste salarial: ₡${s.previous_salary.toLocaleString('es-CR')} → ₡${s.new_salary.toLocaleString('es-CR')}`,
      sub:   s.reason,
      icon:  DollarSign,
      color: 'bg-teal-soft/30 text-teal-deep',
    })),
    ...employee.position_history.map(p => ({
      date: p.start_date,
      type: 'position' as const,
      label: `Cambio de puesto: ${p.position_name}`,
      sub:   `Hasta ${p.end_date ?? 'hoy'}`,
      icon:  Briefcase,
      color: 'bg-navy/10 text-navy-light',
    })),
    ...employee.vacation_records.map(v => ({
      date: v.start_date,
      type: 'vacation' as const,
      label: `${VACATION_TYPE_LABELS[v.type]}: ${v.days} día${v.days !== 1 ? 's' : ''}`,
      sub:   v.notes,
      icon:  Calendar,
      color: STATUS_COLORS[v.status] ?? 'bg-navy/5 text-navy-light',
    })),
    {
      date:  employee.start_date,
      type:  'start' as const,
      label: 'Inicio de relación laboral',
      sub:   employee.position_name,
      icon:  Check,
      color: 'bg-coral/10 text-coral',
    },
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/empleados"
        className="inline-flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronLeft size={15} />
        Empleados
      </Link>

      {/* Header card */}
      <div
        className="rounded-2xl px-6 py-5"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'h-14 w-14 rounded-full flex items-center justify-center shrink-0',
              employee.status === 'active' ? 'bg-navy' : 'bg-navy-light/20'
            )}>
              <span className={cn(
                'text-sm font-bold',
                employee.status === 'active' ? 'text-white' : 'text-navy-light/50'
              )} style={{ fontFamily: 'var(--font-display)' }}>
                {employee.member_initials}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className="text-xl text-navy"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
                >
                  {employee.member_name}
                </h1>
                {employee.status === 'inactive' && (
                  <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-semibold text-coral" style={{ fontFamily: 'var(--font-display)' }}>
                    Inactivo
                  </span>
                )}
              </div>
              <p className="text-sm text-navy-light/60 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                {employee.position_name}
              </p>
              <p className="text-[12px] text-navy-light/40 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                {employee.member_email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/empleados/${id}/editar`}
              className="rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Editar
            </Link>
            {employee.status === 'active' && (
              <button
                type="button"
                onClick={() => setShowTerminateModal(true)}
                className="rounded-full border border-coral/30 px-3.5 py-1.5 text-[12px] text-coral hover:bg-coral/5 transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Dar de baja
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ borderColor: 'var(--outline-variant)' }}>
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

      {/* Tabs */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex overflow-x-auto border-b" style={{ borderColor: 'var(--outline-variant)' }}>
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  tab === t.key
                    ? 'border-coral text-coral'
                    : 'border-transparent text-navy-light/50 hover:text-navy'
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {/* ── Tab: Resumen ── */}
          {tab === 'resumen' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface-low)' }}>
                  <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Salario actual</p>
                  <SalaryBadge amount={employee.current_salary} size="md" />
                </div>
                <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface-low)' }}>
                  <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Tipo de contrato</p>
                  <ContractTypeBadge type={employee.contract_type} size="md" />
                </div>
                <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--surface-low)' }}>
                  <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Vacaciones</p>
                  <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                    {employee.contract_type === 'planilla' ? `${vacDiasDisponibles} días disponibles` : 'No aplica'}
                  </p>
                </div>
              </div>

              {employee.notes && (
                <div>
                  <p className="text-[10px] uppercase tracking-widests text-navy-light/40 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Notas internas</p>
                  <p className="text-sm text-navy-light/70 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                    {employee.notes}
                  </p>
                </div>
              )}

              {employee.vacation_records.filter(v => v.status === 'pendiente').length > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-700" style={{ fontFamily: 'var(--font-body)' }}>
                    Hay {employee.vacation_records.filter(v => v.status === 'pendiente').length} solicitud(es) de vacaciones pendiente(s) de aprobación.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Contrato ── */}
          {tab === 'contrato' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Historial salarial</p>
                {employee.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => { setShowRaiseModal(true); setRaiseSaved(false) }}
                    className="flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}
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
                <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--outline-variant)' }}>
                  <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Historial de puestos</p>
                  {employee.position_history.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'var(--surface-low)' }}>
                      <div className="h-7 w-7 rounded-lg bg-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Briefcase size={13} className="text-navy-light/50" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{p.position_name}</p>
                        <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
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
          )}

          {/* ── Tab: Vacaciones ── */}
          {tab === 'vacaciones' && (
            <div className="space-y-5">
              {employee.contract_type === 'servicios_profesionales' ? (
                <div className="rounded-xl py-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface-low)' }}>
                  <Clock size={24} className="text-navy-light/30" />
                  <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                    Servicios profesionales no aplica para control de vacaciones.
                  </p>
                </div>
              ) : (
                <>
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
                        onClick={() => { setShowVacModal(true); setVacSaved(false) }}
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
                </>
              )}
            </div>
          )}

          {/* ── Tab: Documentos ── */}
          {tab === 'documentos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  {allDocs.length} documento{allDocs.length !== 1 ? 's' : ''}
                </p>
                <>
                  <input
                    ref={uploadRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) setExtraDocs(prev => [...prev, { name: file.name, type: 'otro' }])
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => uploadRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    <Upload size={12} />
                    Subir documento
                  </button>
                </>
              </div>
              {allDocs.length > 0 ? (
                <div className="space-y-2">
                  {allDocs.map((doc, i) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      onDelete={doc.id.startsWith('extra-') ? (docId) => setExtraDocs(prev => prev.filter((_, idx) => `extra-${employee.documents.length + idx}` !== docId)) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-navy-light/40 py-6" style={{ fontFamily: 'var(--font-body)' }}>
                  Sin documentos.
                </p>
              )}
            </div>
          )}

          {/* ── Tab: Historial ── */}
          {tab === 'historial' && (
            <div className="space-y-1">
              {timeline.map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex gap-3 pb-4 relative">
                    {i < timeline.length - 1 && (
                      <div className="absolute left-3.5 top-7 bottom-0 w-px" style={{ background: 'var(--outline-variant)' }} />
                    )}
                    <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10', item.color)}>
                      <Icon size={13} />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                        {item.label}
                      </p>
                      {item.sub && (
                        <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>{item.sub}</p>
                      )}
                      <p className="text-[10px] text-navy-light/30 mt-0.5 font-mono">
                        {new Date(item.date + 'T00:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Ajuste salarial ── */}
      {showRaiseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            {raiseSaved ? (
              <div className="text-center space-y-3 py-4">
                <div className="h-12 w-12 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
                  <Check size={22} className="text-teal-deep" />
                </div>
                <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Ajuste registrado</p>
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Registrar ajuste salarial</h2>
                  <button type="button" onClick={() => setShowRaiseModal(false)}>
                    <X size={18} className="text-navy-light/40" />
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Salario actual</label>
                  <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-mono)' }}>₡{employee.current_salary.toLocaleString('es-CR')}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Nuevo salario <span className="text-coral">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>₡</span>
                    <input
                      type="number"
                      className={cn(inputCls, 'pl-7')}
                      style={{ fontFamily: 'var(--font-body)' }}
                      placeholder={String(employee.current_salary)}
                      value={raiseAmount}
                      onChange={e => setRaiseAmount(e.target.value)}
                    />
                  </div>
                  {raiseAmount && parseFloat(raiseAmount) <= employee.current_salary && (
                    <p className="text-[11px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>El nuevo salario debe ser mayor al actual.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Motivo <span className="text-coral">*</span></label>
                  <input
                    className={inputCls}
                    style={{ fontFamily: 'var(--font-body)' }}
                    placeholder="Ej: Ajuste por desempeño"
                    value={raiseReason}
                    onChange={e => setRaiseReason(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Fecha efectiva <span className="text-coral">*</span></label>
                  <input
                    type="date"
                    className={inputCls}
                    style={{ fontFamily: 'var(--font-body)' }}
                    value={raiseDate}
                    onChange={e => setRaiseDate(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRaiseModal(false)}
                    className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRaiseSaved(true)}
                    disabled={!canRaise() || !raiseReason}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm text-white transition-colors',
                      canRaise() && raiseReason ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
                    )}
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Guardar ajuste
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Dar de baja ── */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon size={18} className="text-coral" />
                <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Dar de baja</h2>
              </div>
              <button type="button" onClick={() => { setShowTerminateModal(false); setTerminateConfirm('') }}>
                <X size={18} className="text-navy-light/40" />
              </button>
            </div>
            <div className="rounded-xl bg-coral/5 border border-coral/20 px-4 py-3">
              <p className="text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                Esta acción marca al empleado como inactivo. Escribí el nombre completo para confirmar.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Escribí "<span className="font-semibold text-navy">{employee.member_name}</span>" para confirmar
              </label>
              <input
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder={employee.member_name}
                value={terminateConfirm}
                onChange={e => setTerminateConfirm(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Fecha de baja</label>
              <input
                type="date"
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                value={terminateDate}
                onChange={e => setTerminateDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Motivo</label>
              <textarea
                className={cn(inputCls, 'resize-none')}
                style={{ fontFamily: 'var(--font-body)' }}
                rows={2}
                placeholder="Motivo de la baja..."
                value={terminateReason}
                onChange={e => setTerminateReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowTerminateModal(false); setTerminateConfirm('') }}
                className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={terminateConfirm !== employee.member_name}
                className={cn(
                  'rounded-full px-4 py-2 text-sm text-white transition-colors',
                  terminateConfirm === employee.member_name ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
                )}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Confirmar baja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Solicitud de vacaciones ── */}
      {showVacModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            {vacSaved ? (
              <div className="text-center space-y-3 py-4">
                <div className="h-12 w-12 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
                  <Check size={22} className="text-teal-deep" />
                </div>
                <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Solicitud registrada</p>
                <button
                  type="button"
                  onClick={() => setShowVacModal(false)}
                  className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Registrar solicitud</h2>
                  <button type="button" onClick={() => setShowVacModal(false)}>
                    <X size={18} className="text-navy-light/40" />
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Tipo</label>
                  <select
                    className={inputCls}
                    style={{ fontFamily: 'var(--font-body)' }}
                    value={vacType}
                    onChange={e => setVacType(e.target.value as VacationRecordType)}
                  >
                    {Object.entries(VACATION_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Desde</label>
                    <input
                      type="date"
                      className={inputCls}
                      style={{ fontFamily: 'var(--font-body)' }}
                      value={vacFrom}
                      onChange={e => setVacFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Hasta</label>
                    <input
                      type="date"
                      className={inputCls}
                      style={{ fontFamily: 'var(--font-body)' }}
                      value={vacTo}
                      onChange={e => setVacTo(e.target.value)}
                    />
                  </div>
                </div>
                {vacFrom && vacTo && (
                  <div className="rounded-lg bg-navy/5 px-3 py-2 flex items-center gap-2">
                    <Clock size={13} className="text-navy-light/50" />
                    <p className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                      {diasHabilesModal} día{diasHabilesModal !== 1 ? 's' : ''} hábil{diasHabilesModal !== 1 ? 'es' : ''}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Notas</label>
                  <textarea
                    className={cn(inputCls, 'resize-none')}
                    style={{ fontFamily: 'var(--font-body)' }}
                    rows={2}
                    placeholder="Descripción de la solicitud..."
                    value={vacNotes}
                    onChange={e => setVacNotes(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowVacModal(false)}
                    className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setVacSaved(true)}
                    disabled={!vacFrom || !vacTo}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm text-white transition-colors',
                      vacFrom && vacTo ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
                    )}
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Guardar solicitud
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

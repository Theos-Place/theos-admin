'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { mockMembers, type Member } from '@/data/mock-members'
import { MOCK_PAID_POSITIONS, MOCK_EMPLOYEES, type ContractType } from '@/data/mock-employees'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { SalaryBadge } from '@/components/employees/SalaryBadge'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  Search,
  Check,
  AlertTriangle,
  Upload,
  FileText,
  CreditCard,
  ShieldCheck,
  File,
  X,
  User,
} from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

const STEPS = [
  { num: 1, label: 'Seleccionar persona' },
  { num: 2, label: 'Definir contrato' },
  { num: 3, label: 'Confirmar y documentos' },
]

type DocKey = 'contrato' | 'cedula' | 'ccss'
const REQUIRED_DOCS: { key: DocKey; label: string; icon: React.ElementType }[] = [
  { key: 'contrato', label: 'Contrato firmado',      icon: FileText   },
  { key: 'cedula',   label: 'Cédula de identidad',   icon: CreditCard },
  { key: 'ccss',     label: 'Inscripción CCSS',       icon: ShieldCheck },
]

const OPTIONAL_DOCS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'otro',     label: 'Otro documento',         icon: File },
]

const alreadyHiredIds = new Set(
  MOCK_EMPLOYEES.filter(e => e.status === 'active').map(e => e.member_id)
)

export default function NuevoEmpleadoPage() {
  const router = useRouter()

  const [step, setStep]                           = useState(1)
  const [query, setQuery]                         = useState('')
  const [selected, setSelected]                   = useState<Member | null>(null)

  const [positionId, setPositionId]               = useState('')
  const [contractType, setContractType]           = useState<ContractType>('planilla')
  const [salary, setSalary]                       = useState('')
  const [startDate, setStartDate]                 = useState('')
  const [notes, setNotes]                         = useState('')

  const [uploadedDocs, setUploadedDocs]           = useState<Record<string, string>>({})
  const [done, setDone]                           = useState(false)

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const activePositions = useMemo(
    () => MOCK_PAID_POSITIONS.filter(p => p.is_active),
    []
  )

  const selectedPosition = useMemo(
    () => activePositions.find(p => p.id === positionId) ?? null,
    [positionId, activePositions]
  )

  const salaryNum    = parseFloat(salary) || 0
  const salaryOutOfRange = selectedPosition !== null && salaryNum > 0 && (
    salaryNum < selectedPosition.salary_min || salaryNum > selectedPosition.salary_max
  )

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return mockMembers
      .filter(m => m.status === 'active' && !alreadyHiredIds.has(m.id))
      .filter(m =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.cedula ?? '').includes(q)
      )
      .slice(0, 8)
  }, [query])

  function canAdvanceStep1() { return selected !== null }
  function canAdvanceStep2() { return positionId !== '' && salary !== '' && startDate !== '' }
  function canFinish() {
    return REQUIRED_DOCS.every(d => uploadedDocs[d.key])
  }

  function handleSelectPosition(id: string) {
    setPositionId(id)
    const pos = activePositions.find(p => p.id === id)
    if (pos) setContractType(pos.contract_type)
  }

  function simulateUpload(key: string, fileName: string) {
    setUploadedDocs(prev => ({ ...prev, [key]: fileName }))
  }

  function removeDoc(key: string) {
    setUploadedDocs(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={28} className="text-teal-deep" />
          </div>
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Contrato formalizado
          </p>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            {selected?.first_name} {selected?.last_name} fue agregado como empleado.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/empleados"
              className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Ver empleados
            </Link>
            <Link
              href="/empleados/nuevo"
              className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Contratar otro
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 rounded-2xl px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/empleados"
            className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={16} />
            Empleados
          </Link>
          <span className="text-navy-light/20">|</span>
          <span className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Contratar empleado
          </span>
          <span
            className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold text-navy-light/50 lg:hidden"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {step}/{STEPS.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/empleados"
            className="rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </Link>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canAdvanceStep1() : !canAdvanceStep2()}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12px] text-white transition-colors',
                (step === 1 ? canAdvanceStep1() : canAdvanceStep2())
                  ? 'bg-coral hover:bg-coral-deep'
                  : 'bg-navy-light/20 cursor-not-allowed'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Siguiente →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDone(true)}
              disabled={!canFinish()}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12px] text-white transition-colors',
                canFinish() ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Formalizar contrato
            </button>
          )}
        </div>
      </div>

      {/* Desktop step bar */}
      <div
        className="hidden lg:flex items-center rounded-2xl px-6 py-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors',
                step > s.num
                  ? 'bg-teal-deep text-white'
                  : step === s.num
                  ? 'bg-coral text-white'
                  : 'bg-navy/10 text-navy-light/40'
              )} style={{ fontFamily: 'var(--font-display)' }}>
                {step > s.num ? <Check size={13} /> : s.num}
              </div>
              <span className={cn(
                'text-[12px] font-medium whitespace-nowrap',
                step === s.num ? 'text-navy' : step > s.num ? 'text-teal-deep' : 'text-navy-light/40'
              )} style={{ fontFamily: 'var(--font-display)' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-4" style={{ background: 'var(--outline-variant)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — Seleccionar persona */}
      {step === 1 && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Paso 1 — Buscar miembro
          </p>

          {selected ? (
            <div className="rounded-xl border p-4 flex items-center justify-between gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-navy flex items-center justify-center shrink-0">
                  <span className="text-[13px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    {selected.first_name[0]}{selected.last_name[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                    {selected.first_name} {selected.last_name}
                  </p>
                  <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                    {selected.email}
                  </p>
                  {selected.cedula && (
                    <p className="text-[11px] text-navy-light/40 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                      {selected.cedula}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-teal-soft/30 flex items-center justify-center">
                  <Check size={14} className="text-teal-deep" />
                </div>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setQuery('') }}
                  className="h-7 w-7 rounded-full hover:bg-surface-low flex items-center justify-center transition-colors"
                >
                  <X size={13} className="text-navy-light/40" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
                <input
                  autoFocus
                  className={cn(inputCls, 'pl-9')}
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder="Buscar por nombre, email o cédula..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              {query.trim() !== '' && (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--outline-variant)' }}>
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                        No se encontraron miembros disponibles.
                      </p>
                    </div>
                  ) : (
                    searchResults.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setSelected(m); setQuery('') }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-low transition-colors',
                          idx > 0 && 'border-t'
                        )}
                        style={{ borderColor: 'var(--outline-variant)' }}
                      >
                        <div className="h-9 w-9 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>
                            {m.first_name[0]}{m.last_name[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>
                            {m.first_name} {m.last_name}
                          </p>
                          <p className="text-[11px] text-navy-light/50 truncate" style={{ fontFamily: 'var(--font-body)' }}>
                            {m.email}
                            {m.cedula && <span className="ml-2 font-mono">{m.cedula}</span>}
                          </p>
                        </div>
                        <span className="text-[11px] text-navy-light/30 shrink-0" style={{ fontFamily: 'var(--font-body)' }}>
                          {m.profession}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {query.trim() === '' && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="h-12 w-12 rounded-full bg-navy/5 flex items-center justify-center">
                    <User size={20} className="text-navy-light/30" />
                  </div>
                  <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                    Escribí el nombre o cédula del miembro
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Definir contrato */}
      {step === 2 && (
        <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Paso 2 — Definir contrato
          </p>

          {/* Puesto */}
          <div className="space-y-1">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Puesto <span className="text-coral">*</span>
            </label>
            <select
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={positionId}
              onChange={e => handleSelectPosition(e.target.value)}
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

          {/* Salario */}
          <div className="space-y-1">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Salario mensual <span className="text-coral">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>₡</span>
              <input
                type="number"
                className={cn(inputCls, 'pl-7')}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="0"
                value={salary}
                onChange={e => setSalary(e.target.value)}
              />
            </div>
            {salaryOutOfRange && selectedPosition && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-1">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-700" style={{ fontFamily: 'var(--font-body)' }}>
                  El salario está fuera del rango aprobado para este puesto (₡{selectedPosition.salary_min.toLocaleString('es-CR')} — ₡{selectedPosition.salary_max.toLocaleString('es-CR')}). Se requiere aprobación adicional.
                </p>
              </div>
            )}
          </div>

          {/* Fecha de inicio */}
          <div className="space-y-1">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Fecha de inicio <span className="text-coral">*</span>
            </label>
            <input
              type="date"
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Notas internas
            </label>
            <textarea
              className={cn(inputCls, 'resize-none')}
              style={{ fontFamily: 'var(--font-body)' }}
              rows={3}
              placeholder="Observaciones, acuerdos especiales, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Step 3 — Documentos y confirmación */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Resumen */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <p className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Resumen del contrato
            </p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-navy flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  {selected?.first_name[0]}{selected?.last_name[0]}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                  {selected?.first_name} {selected?.last_name}
                </p>
                <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  {selected?.email}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
              {[
                { label: 'Puesto',    value: selectedPosition?.name ?? '—' },
                { label: 'Comité',    value: selectedPosition?.committee_name ?? '—' },
                { label: 'Inicio',    value: startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                { label: 'Salario',   value: salary ? `₡${parseFloat(salary).toLocaleString('es-CR')}` : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
                  <p className="text-sm text-navy mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>{value}</p>
                </div>
              ))}
            </div>
            {salaryOutOfRange && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-700" style={{ fontFamily: 'var(--font-body)' }}>
                  Salario fuera del rango aprobado — requiere aprobación adicional.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <ContractTypeBadge type={contractType} size="sm" />
            </div>
          </div>

          {/* Documentos requeridos */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Documentos requeridos
              </p>
              <span className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-mono)' }}>
                {REQUIRED_DOCS.filter(d => uploadedDocs[d.key]).length}/{REQUIRED_DOCS.length}
              </span>
            </div>
            <div className="space-y-2">
              {REQUIRED_DOCS.map(doc => {
                const DocIcon = doc.icon
                const uploaded = uploadedDocs[doc.key]
                return (
                  <div
                    key={doc.key}
                    className="flex items-center justify-between gap-3 rounded-xl p-3"
                    style={{ background: 'var(--surface-low)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                        uploaded ? 'bg-teal-soft/30' : 'bg-navy/5'
                      )}>
                        {uploaded
                          ? <Check size={15} className="text-teal-deep" />
                          : <DocIcon size={15} className="text-navy-light/40" />
                        }
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                          {doc.label}
                        </p>
                        {uploaded && (
                          <p className="text-[11px] text-teal-deep font-mono truncate max-w-[160px]">
                            {uploaded}
                          </p>
                        )}
                      </div>
                    </div>
                    {uploaded ? (
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.key)}
                        className="h-7 w-7 rounded-full hover:bg-coral/10 flex items-center justify-center transition-colors"
                      >
                        <X size={13} className="text-coral" />
                      </button>
                    ) : (
                      <>
                        <input
                          ref={el => { fileInputRefs.current[doc.key] = el }}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) simulateUpload(doc.key, file.name)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[doc.key]?.click()}
                          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] text-navy-light hover:bg-white transition-colors"
                          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                        >
                          <Upload size={12} />
                          Subir
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Documento opcional */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <p className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Documentos adicionales
            </p>
            {OPTIONAL_DOCS.map(doc => {
              const DocIcon = doc.icon
              const uploaded = uploadedDocs[doc.key]
              return (
                <div
                  key={doc.key}
                  className="flex items-center justify-between gap-3 rounded-xl p-3"
                  style={{ background: 'var(--surface-low)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                      uploaded ? 'bg-teal-soft/30' : 'bg-navy/5'
                    )}>
                      {uploaded
                        ? <Check size={15} className="text-teal-deep" />
                        : <DocIcon size={15} className="text-navy-light/40" />
                      }
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                        {doc.label}
                      </p>
                      {uploaded && (
                        <p className="text-[11px] text-teal-deep font-mono truncate max-w-[160px]">
                          {uploaded}
                        </p>
                      )}
                    </div>
                  </div>
                  {uploaded ? (
                    <button
                      type="button"
                      onClick={() => removeDoc(doc.key)}
                      className="h-7 w-7 rounded-full hover:bg-coral/10 flex items-center justify-center transition-colors"
                    >
                      <X size={13} className="text-coral" />
                    </button>
                  ) : (
                    <>
                      <input
                        ref={el => { fileInputRefs.current[doc.key] = el }}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) simulateUpload(doc.key, file.name)
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[doc.key]?.click()}
                        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] text-navy-light hover:bg-white transition-colors"
                        style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                      >
                        <Upload size={12} />
                        Subir
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {!canFinish() && (
            <p className="text-center text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              Subí los 3 documentos requeridos para formalizar el contrato.
            </p>
          )}
        </div>
      )}

      {/* Step back button (steps 2 and 3) */}
      {step > 1 && (
        <button
          type="button"
          onClick={() => setStep(s => s - 1)}
          className="flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={15} />
          Volver al paso anterior
        </button>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { mockMembers, type Member } from '@/data/mock-members'
import { DuplicateWarning } from '@/components/members/DuplicateWarning'
import { CR_PROVINCES, CR_CANTONS, CR_DISTRICTS } from '@/data/costa-rica-geo'
import { ACTIVE_SEDES as SEDES } from '@/data/mock-sedes'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step1Data = {
  first_name: string
  last_name: string
  cedula: string
  email: string
  phone: string
  birth_date: string
  gender: string
  marital_status: string
  province: string
  canton: string
  district: string
  profession: string
  workplace: string
  sede: string
  alergias: string
  medicamentos: string
  señas: string
}

type FamilyManualData = {
  first_name: string
  last_name: string
  relation: string
  birth_date: string
  email: string
  phone: string
}

type FamilyItem =
  | { kind: 'linked'; member: Member; relation: string }
  | { kind: 'new'; data: FamilyManualData; cedula: string }

type FamilyLookupState =
  | { state: 'idle' }
  | { state: 'found'; member: Member }
  | { state: 'not-found' }
  | { state: 'manual' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateAge(dateStr: string): number {
  const birth = new Date(dateStr)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function defaultManualForm(): FamilyManualData {
  return { first_name: '', last_name: '', relation: '', birth_date: '', email: '', phone: '' }
}

// ─── Styling constants ────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy placeholder-navy-light/40 outline-none focus:ring-1 focus:ring-coral/30 transition-all border-0'

const selectCls =
  'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 transition-all border-0 appearance-none'

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="block text-[11px] font-medium text-navy-light/50 mb-1.5 uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {label}
        {required && <span className="text-coral ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-coral mt-1" style={{ fontFamily: 'var(--font-body)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

type StepIndicatorProps = {
  current: number
}

const STEP_LABELS = ['Datos del miembro', 'Núcleo familiar', 'Confirmación']

function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="flex items-center mb-8">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1
        const done = num < current
        const active = num === current

        return (
          <div key={num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs text-white transition-all',
                  done ? 'bg-coral' : active ? 'bg-navy' : 'bg-surface-low text-navy-light/50'
                )}
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : num}
              </div>
              <span
                className={cn(
                  'mt-1 text-[10px] text-center whitespace-nowrap',
                  active ? 'text-navy font-medium' : 'text-navy-light/50'
                )}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 mb-4 transition-colors',
                  done ? 'bg-coral' : 'bg-surface-low'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NuevoMiembroPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)

  // Step 1
  const [data, setData] = useState<Step1Data>({
    first_name: '',
    last_name: '',
    cedula: '',
    email: '',
    phone: '',
    birth_date: '',
    gender: '',
    marital_status: '',
    province: '',
    canton: '',
    district: '',
    profession: '',
    workplace: '',
    sede: '',
    alergias: '',
    medicamentos: '',
    señas: '',
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [duplicate, setDuplicate] = useState<Member | null>(null)
  const [dismissedDuplicate, setDismissedDuplicate] = useState(false)
  const [tseLoading, setTseLoading] = useState(false)
  const [tseBanner, setTseBanner] = useState<{ type: 'success' | 'warn'; text: string } | null>(null)

  // Step 2
  const [hasFamily, setHasFamily] = useState(false)
  const [familyMembers, setFamilyMembers] = useState<FamilyItem[]>([])
  const [addingFamily, setAddingFamily] = useState(false)
  const [familyCedulaInput, setFamilyCedulaInput] = useState('')
  const [familyLookup, setFamilyLookup] = useState<FamilyLookupState>({ state: 'idle' })
  const [newFamilyManual, setNewFamilyManual] = useState<FamilyManualData>(defaultManualForm())
  const [familyManualErrors, setFamilyManualErrors] = useState<Partial<Record<string, string>>>({})

  // Step 3
  const [sendWhatsapp, setSendWhatsapp] = useState(true)
  const [sendEmail, setSendEmail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showToast, setShowToast] = useState(false)

  // ── Derived values (no useEffect) ─────────────────────────────────────────

  const isMinor = data.birth_date ? calculateAge(data.birth_date) < 18 : false
  const isFamilyMinor = newFamilyManual.birth_date ? calculateAge(newFamilyManual.birth_date) < 18 : false
  const availableCantons = data.province ? (CR_CANTONS[data.province] ?? []) : []
  const availableDistricts = data.canton ? (CR_DISTRICTS[data.canton] ?? []) : []

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleData(field: keyof Step1Data, value: string) {
    setData(prev => {
      const updated = { ...prev, [field]: value }
      // Reset dependent selects
      if (field === 'province') {
        updated.canton = ''
        updated.district = ''
      }
      if (field === 'canton') {
        updated.district = ''
      }
      return updated
    })
  }

  async function handleCedulaBlur() {
    const cedula = data.cedula.trim()
    if (!cedula) return
    const found = mockMembers.find(m => m.cedula != null && m.cedula === cedula)
    setDuplicate(found ?? null)
    setDismissedDuplicate(false)
    setTseLoading(true)
    setTseBanner(null)
    try {
      const res = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${cedula}`)
      if (res.ok) {
        const json = await res.json()
        const nombre: string = json?.nombre ?? ''
        if (nombre) {
          const parts = nombre.split(' ')
          handleData('first_name', parts[0] ?? '')
          setTseBanner({ type: 'success', text: `Nombre obtenido del TSE: ${nombre}` })
        } else {
          setTseBanner({ type: 'warn', text: 'Cédula no encontrada en el TSE' })
        }
      } else {
        setTseBanner({ type: 'warn', text: 'No se pudo consultar el TSE' })
      }
    } catch {
      setTseBanner({ type: 'warn', text: 'No se pudo consultar el TSE' })
    } finally {
      setTseLoading(false)
    }
  }

  function proceedFromStep1() {
    const e: Record<string, string> = {}
    if (!data.first_name.trim()) e.first_name = 'Requerido'
    if (!data.last_name.trim()) e.last_name = 'Requerido'
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }
    setErrors({})
    setStep(2)
  }

  function handleFamilyCedulaBlur() {
    const cedula = familyCedulaInput.trim()
    if (!cedula) { setFamilyLookup({ state: 'idle' }); return }
    const normalize = (s: string) => s.replace(/[-\s]/g, '')
    const found = mockMembers.find(m => m.cedula != null && normalize(m.cedula) === normalize(cedula))
    if (found) {
      setFamilyLookup({ state: 'found', member: found })
      setNewFamilyManual(f => ({
        ...f,
        first_name: f.first_name || found.first_name,
        last_name:  f.last_name  || found.last_name,
      }))
    } else {
      setFamilyLookup({ state: 'not-found' })
    }
  }

  function resetFamilyForm() {
    setFamilyCedulaInput('')
    setFamilyLookup({ state: 'idle' })
    setNewFamilyManual(defaultManualForm())
    setFamilyManualErrors({})
    setAddingFamily(false)
  }

  function addFamilyMemberToList() {
    const e: Record<string, string> = {}
    if (!newFamilyManual.first_name.trim()) e.first_name = 'Requerido'
    if (!newFamilyManual.last_name.trim())  e.last_name  = 'Requerido'
    if (!newFamilyManual.relation)          e.relation   = 'Requerido'
    if (Object.keys(e).length > 0) { setFamilyManualErrors(e); return }
    const manualData = { ...newFamilyManual, last_name: newFamilyManual.last_name || data.last_name }
    if (familyLookup.state === 'found') {
      setFamilyMembers(prev => [...prev, { kind: 'linked', member: familyLookup.member, relation: newFamilyManual.relation }])
    } else {
      setFamilyMembers(prev => [...prev, { kind: 'new', cedula: familyCedulaInput.trim(), data: manualData }])
    }
    resetFamilyForm()
  }

  function removeFamilyMember(idx: number) {
    setFamilyMembers(prev => prev.filter((_, i) => i !== idx))
  }

  function familyItemName(item: FamilyItem): string {
    if (item.kind === 'linked') return item.member.first_name + ' ' + item.member.last_name
    return item.data.first_name + ' ' + (item.data.last_name || data.last_name)
  }

  function familyItemInitials(item: FamilyItem): string {
    const name = familyItemName(item)
    const parts = name.trim().split(' ')
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '?')).toUpperCase()
  }

  function familyItemRelation(item: FamilyItem): string {
    return item.kind === 'linked' ? item.relation : item.data.relation
  }

  function handleSubmit() {
    setSubmitting(true)
    setTimeout(() => {
      setShowToast(true)
      setTimeout(() => router.push('/miembros'), 1800)
    }, 800)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          Nuevo miembro
        </h1>
        <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          Completa los tres pasos para crear el perfil.
        </p>
      </div>

      {/* Card */}
      <div
        className="rounded-2xl bg-surface-card p-6"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <StepIndicator current={step} />

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" required error={errors.first_name}>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Ej: Alejandro"
                  value={data.first_name}
                  onChange={e => handleData('first_name', e.target.value)}
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </Field>
              <Field label="Apellidos" required error={errors.last_name}>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Ej: Ruiz Moreno"
                  value={data.last_name}
                  onChange={e => handleData('last_name', e.target.value)}
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </Field>
            </div>

            <Field label="Cédula" error={errors.cedula}>
              <div className="relative">
                <input
                  type="text"
                  className={cn(inputCls, tseLoading ? 'pr-9' : '')}
                  placeholder="Ej: 108470291"
                  value={data.cedula}
                  onChange={e => handleData('cedula', e.target.value)}
                  onBlur={handleCedulaBlur}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                {tseLoading && (
                  <Loader2
                    size={15}
                    strokeWidth={2}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-navy-light/40"
                  />
                )}
              </div>
              {tseBanner && (
                <div
                  className={cn(
                    'mt-1.5 rounded-lg px-3 py-2 text-xs',
                    tseBanner.type === 'success'
                      ? 'bg-teal-soft/20 text-teal-deep'
                      : 'bg-amber-50 text-amber-700'
                  )}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {tseBanner.text}
                </div>
              )}
              {duplicate && !dismissedDuplicate && (
                <DuplicateWarning
                  member={duplicate}
                  onDismiss={() => setDismissedDuplicate(true)}
                />
              )}
            </Field>

            <Field label="Sede" error={errors.sede}>
              <select
                className={selectCls}
                value={data.sede}
                onChange={e => handleData('sede', e.target.value)}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <option value="">Seleccionar sede…</option>
                {SEDES.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.day} {s.time}</option>
                ))}
              </select>
            </Field>

            {isMinor ? (
              <div
                className="rounded-xl bg-teal-soft/20 px-3 py-2.5 text-sm text-teal-deep"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Modo menor de edad — correo y teléfono opcionales
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Correo electrónico" error={errors.email}>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="correo@ejemplo.com"
                    value={data.email}
                    onChange={e => handleData('email', e.target.value)}
                    style={{ fontFamily: 'var(--font-body)' }}
                  />
                </Field>
                <Field label="Teléfono" error={errors.phone}>
                  <input
                    type="tel"
                    className={inputCls}
                    placeholder="+506 8800 0000"
                    value={data.phone}
                    onChange={e => handleData('phone', e.target.value)}
                    style={{ fontFamily: 'var(--font-body)' }}
                  />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha de nacimiento">
                <input
                  type="date"
                  className={inputCls}
                  value={data.birth_date}
                  onChange={e => handleData('birth_date', e.target.value)}
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </Field>
              <Field label="Género">
                <select
                  className={selectCls}
                  value={data.gender}
                  onChange={e => handleData('gender', e.target.value)}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <option value="">Seleccionar…</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="no_indica">No indica</option>
                </select>
              </Field>
            </div>

            <Field label="Estado civil">
              <select
                className={selectCls}
                value={data.marital_status}
                onChange={e => handleData('marital_status', e.target.value)}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <option value="">Seleccionar…</option>
                <option value="Soltero/a">Soltero/a</option>
                <option value="Casado/a">Casado/a</option>
                <option value="Divorciado/a">Divorciado/a</option>
                <option value="Viudo/a">Viudo/a</option>
              </select>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Provincia">
                <select
                  className={selectCls}
                  value={data.province}
                  onChange={e => handleData('province', e.target.value)}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <option value="">Provincia…</option>
                  {CR_PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Cantón">
                <select
                  className={selectCls}
                  value={data.canton}
                  onChange={e => handleData('canton', e.target.value)}
                  disabled={!data.province}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <option value="">Cantón…</option>
                  {availableCantons.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Distrito">
                <select
                  className={selectCls}
                  value={data.district}
                  onChange={e => handleData('district', e.target.value)}
                  disabled={!data.canton}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <option value="">Distrito…</option>
                  {availableDistricts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Señas">
              <textarea
                className={inputCls}
                placeholder="Ej: Casa amarilla con portón negro, 100m norte del parque"
                rows={2}
                value={data.señas}
                onChange={e => handleData('señas', e.target.value)}
                style={{ fontFamily: 'var(--font-body)', resize: 'none' }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Profesión / Ocupación">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Ej: Ingeniero en Sistemas"
                  value={data.profession}
                  onChange={e => handleData('profession', e.target.value)}
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </Field>
              <Field label="Lugar de trabajo">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Ej: Intel Costa Rica"
                  value={data.workplace}
                  onChange={e => handleData('workplace', e.target.value)}
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </Field>
            </div>

            <Field label="Alergias">
              <textarea
                className={inputCls}
                placeholder="Ej: Polen, mariscos, penicilina…"
                rows={2}
                value={data.alergias}
                onChange={e => handleData('alergias', e.target.value)}
                style={{ fontFamily: 'var(--font-body)', resize: 'none' }}
              />
            </Field>

            <Field label="Medicamentos">
              <textarea
                className={inputCls}
                placeholder="Ej: Atorvastatina 20mg, Metformina…"
                rows={2}
                value={data.medicamentos}
                onChange={e => handleData('medicamentos', e.target.value)}
                style={{ fontFamily: 'var(--font-body)', resize: 'none' }}
              />
            </Field>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2
              className="text-sm font-medium text-navy"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Núcleo familiar
            </h2>

            {/* Toggle */}
            <div className="flex items-center justify-between rounded-xl bg-surface-low px-4 py-3">
              <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                ¿Viene con familia?
              </span>
              <button
                type="button"
                onClick={() => setHasFamily(h => !h)}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  hasFamily ? 'bg-coral' : 'bg-navy-light/20'
                )}
                aria-checked={hasFamily}
                role="switch"
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    hasFamily ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {hasFamily && (
              <div className="space-y-3">
                {/* Listed family members */}
                {familyMembers.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-3"
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs',
                        item.kind === 'linked' ? 'bg-teal-deep' : 'bg-navy'
                      )}
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
                    >
                      {familyItemInitials(item)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>
                        {familyItemName(item)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="rounded-full bg-teal-soft/30 px-2 py-0.5 text-[10px] text-teal-deep"
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          {familyItemRelation(item)}
                        </span>
                        {item.kind === 'linked' ? (
                          <span
                            className="rounded-full bg-teal-soft/50 px-2 py-0.5 text-[10px] text-teal-deep flex items-center gap-1"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            <span>⇄</span> Perfil existente
                          </span>
                        ) : (
                          <span
                            className="rounded-full bg-surface-card px-2 py-0.5 text-[10px] text-navy-light/50"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            Perfil nuevo
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFamilyMember(idx)}
                      className="rounded-lg p-1.5 text-navy-light/30 hover:text-coral hover:bg-surface-card transition-all"
                      aria-label="Eliminar familiar"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}

                {/* Inline add form */}
                {addingFamily ? (
                  <div className="rounded-xl border bg-surface-card p-4 space-y-3" style={{ borderColor: 'var(--outline-variant)' }}>
                    <p className="text-xs font-medium text-navy-light/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                      Agregar familiar
                    </p>

                    {/* Cédula — siempre primero */}
                    <Field label="Cédula">
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="Ej: 108470291 (opcional para menores)"
                        value={familyCedulaInput}
                        onChange={e => { setFamilyCedulaInput(e.target.value); setFamilyLookup({ state: 'idle' }) }}
                        onBlur={handleFamilyCedulaBlur}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                    </Field>

                    {/* Indicador de búsqueda */}
                    {familyLookup.state === 'found' && (
                      <div className="flex items-center gap-2 rounded-lg bg-teal-soft/20 px-3 py-2">
                        <span className="text-teal-deep text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                          ⇄ Perfil encontrado: <strong>{familyLookup.member.first_name} {familyLookup.member.last_name}</strong> — se vinculará al agregar
                        </span>
                      </div>
                    )}
                    {familyLookup.state === 'not-found' && familyCedulaInput.trim() && (
                      <p className="text-xs text-navy-light/40 italic" style={{ fontFamily: 'var(--font-body)' }}>
                        Cédula no encontrada en el sistema — se creará un perfil nuevo
                      </p>
                    )}

                    {/* Nombre y apellidos — siempre visibles */}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nombre" required error={familyManualErrors.first_name}>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="Nombre"
                          value={newFamilyManual.first_name}
                          onChange={e => setNewFamilyManual(f => ({ ...f, first_name: e.target.value }))}
                          style={{ fontFamily: 'var(--font-body)' }}
                        />
                      </Field>
                      <Field label="Apellidos" required error={familyManualErrors.last_name}>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder={data.last_name || 'Apellidos'}
                          value={newFamilyManual.last_name}
                          onChange={e => setNewFamilyManual(f => ({ ...f, last_name: e.target.value }))}
                          style={{ fontFamily: 'var(--font-body)' }}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Relación" required error={familyManualErrors.relation}>
                        <select
                          className={selectCls}
                          value={newFamilyManual.relation}
                          onChange={e => setNewFamilyManual(f => ({ ...f, relation: e.target.value }))}
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          <option value="">Seleccionar…</option>
                          <option value="Cónyuge">Cónyuge</option>
                          <option value="Hijo/a">Hijo/a</option>
                          <option value="Padre">Padre</option>
                          <option value="Madre">Madre</option>
                          <option value="Hermano/a">Hermano/a</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </Field>
                      <Field label="Fecha de nacimiento">
                        <input
                          type="date"
                          className={inputCls}
                          value={newFamilyManual.birth_date}
                          onChange={e => setNewFamilyManual(f => ({ ...f, birth_date: e.target.value }))}
                          style={{ fontFamily: 'var(--font-body)' }}
                        />
                      </Field>
                    </div>

                    {newFamilyManual.birth_date && !isFamilyMinor && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Correo">
                          <input
                            type="email"
                            className={inputCls}
                            placeholder="correo@…"
                            value={newFamilyManual.email}
                            onChange={e => setNewFamilyManual(f => ({ ...f, email: e.target.value }))}
                            style={{ fontFamily: 'var(--font-body)' }}
                          />
                        </Field>
                        <Field label="Teléfono">
                          <input
                            type="tel"
                            className={inputCls}
                            placeholder="+506…"
                            value={newFamilyManual.phone}
                            onChange={e => setNewFamilyManual(f => ({ ...f, phone: e.target.value }))}
                            style={{ fontFamily: 'var(--font-body)' }}
                          />
                        </Field>
                      </div>
                    )}

                    {/* Botones */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={addFamilyMemberToList}
                        className="rounded-xl bg-coral px-4 py-2 text-sm text-white transition-all hover:bg-coral-deep active:scale-95"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {familyLookup.state === 'found' ? 'Vincular' : 'Agregar'}
                      </button>
                      <button
                        type="button"
                        onClick={resetFamilyForm}
                        className="rounded-xl px-4 py-2 text-sm text-navy-light/60 transition-colors hover:bg-surface-low"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingFamily(true)}
                    className="w-full rounded-xl border border-dashed py-3 text-sm text-navy-light/50 hover:border-coral/40 hover:text-coral transition-all"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    + Agregar familiar
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2
              className="text-sm font-medium text-navy"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Confirmación
            </h2>

            {/* Main member card */}
            <div className="rounded-xl bg-surface-low p-4 flex items-start gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-white text-sm"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                {((data.first_name[0] ?? '?') + (data.last_name[0] ?? '?')).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base text-navy" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                  {data.first_name} {data.last_name}
                </p>
                {data.cedula && (
                  <p className="text-xs text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                    {data.cedula}
                  </p>
                )}
                <div className="mt-2 space-y-1">
                  {data.email && (
                    <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{data.email}</p>
                  )}
                  {data.phone && (
                    <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{data.phone}</p>
                  )}
                  {data.birth_date && (
                    <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                      {calculateAge(data.birth_date)} años
                      {isMinor && (
                        <span className="ml-2 rounded-full bg-teal-soft/30 px-2 py-0.5 text-[10px] text-teal-deep">Menor</span>
                      )}
                    </p>
                  )}
                  {data.province && (
                    <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                      {[data.district, data.canton, data.province].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {data.sede && (
                    <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                      Sede: {SEDES.find(s => s.id === data.sede)?.name}
                    </p>
                  )}
                  {data.profession && (
                    <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{data.profession}</p>
                  )}
                  {data.alergias && (
                    <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                      Alergias: {data.alergias}
                    </p>
                  )}
                  {data.medicamentos && (
                    <p className="text-xs text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                      Medicamentos: {data.medicamentos}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Family members */}
            {familyMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-navy-light/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                  Familiares ({familyMembers.length})
                </p>
                {familyMembers.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-2.5">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs',
                        item.kind === 'linked' ? 'bg-teal-deep' : 'bg-navy'
                      )}
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
                    >
                      {familyItemInitials(item)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                        {familyItemName(item)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                          {familyItemRelation(item)}
                        </p>
                        {item.kind === 'linked' ? (
                          <span className="rounded-full bg-teal-soft/50 px-2 py-0.5 text-[10px] text-teal-deep" style={{ fontFamily: 'var(--font-body)' }}>
                            Perfil existente
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface-card px-2 py-0.5 text-[10px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                            Perfil nuevo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notification checkboxes */}
            <div className="space-y-3">
              <p className="text-xs text-navy-light/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                Notificaciones de bienvenida
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-coral h-4 w-4"
                  checked={sendWhatsapp}
                  onChange={e => setSendWhatsapp(e.target.checked)}
                />
                <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                  Enviar mensaje de bienvenida por WhatsApp
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-coral h-4 w-4"
                  checked={sendEmail}
                  onChange={e => setSendEmail(e.target.checked)}
                />
                <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                  Enviar mensaje de bienvenida por correo
                </span>
              </label>
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-full bg-coral py-3 text-sm font-medium text-white transition-all hover:bg-coral-deep active:scale-[0.98] disabled:opacity-60"
              style={{ boxShadow: 'var(--shadow-pulse)', fontFamily: 'var(--font-body)' }}
            >
              {submitting ? 'Creando perfil…' : 'Crear perfil'}
            </button>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-8 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Atrás
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/miembros')}
              className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Cancelar
            </button>
          )}

          {step < 3 && (
            <button
              type="button"
              onClick={step === 1 ? proceedFromStep1 : () => setStep(3)}
              className="rounded-xl bg-navy px-5 py-2 text-sm text-white transition-all hover:bg-navy-light active:scale-95"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Siguiente
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div
          className="fixed bottom-6 right-6 flex items-center gap-3 rounded-2xl bg-navy px-5 py-3.5 text-white"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          <Check size={16} className="text-teal" strokeWidth={2.5} />
          <span className="text-sm" style={{ fontFamily: 'var(--font-body)' }}>
            ¡Perfil creado exitosamente!
          </span>
        </div>
      )}
    </div>
  )
}

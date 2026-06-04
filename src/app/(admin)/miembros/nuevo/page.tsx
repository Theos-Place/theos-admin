'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { mockMembers, type Member } from '@/data/mock-members'
import { CR_CANTONS, CR_DISTRICTS } from '@/data/costa-rica-geo'
import { cn } from '@/lib/utils'
import { REDIRECT_LONG_AFTER_SAVE_MS } from '@/lib/constants'
import { NewMemberStep1 } from './_components/NewMemberStep1'
import { NewMemberStep2 } from './_components/NewMemberStep2'
import { NewMemberStep3 } from './_components/NewMemberStep3'

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
  emergency_contact_name: string
  emergency_contact_phone: string
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

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ['Datos del miembro', 'Núcleo familiar', 'Confirmación']

function StepIndicator({ current }: { current: number }) {
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
    emergency_contact_name: '',
    emergency_contact_phone: '',
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

  // ── Derived values ────────────────────────────────────────────────────────

  const isMinor = data.birth_date ? calculateAge(data.birth_date) < 18 : false
  const isFamilyMinor = newFamilyManual.birth_date ? calculateAge(newFamilyManual.birth_date) < 18 : false
  const availableCantons = data.province ? (CR_CANTONS[data.province] ?? []) : []
  const availableDistricts = data.canton ? (CR_DISTRICTS[data.canton] ?? []) : []

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleData(field: keyof Step1Data, value: string) {
    setData(prev => {
      const updated = { ...prev, [field]: value }
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

  async function handleSubmit() {
    setSubmitting(true)
    const payload = {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      cedula: data.cedula.trim() || null,
      email: data.email.trim() || null,
      phone: data.phone.trim() || null,
      birth_date: data.birth_date || null,
      gender: data.gender || null,
      marital_status: data.marital_status || null,
      province: data.province || null,
      canton: data.canton || null,
      district: data.district || null,
      occupation: data.profession.trim() || null,
      workplace: data.workplace.trim() || null,
      address: data.señas.trim() || null,
      allergies: data.alergias.trim() || null,
      medications: data.medicamentos.trim() || null,
      emergency_contact_name: data.emergency_contact_name.trim() || null,
      emergency_contact_phone: data.emergency_contact_phone.trim() || null,
      is_donor: false,
      is_active: true,
    }
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error guardando el miembro')
      setShowToast(true)
      setTimeout(() => router.push('/miembros'), REDIRECT_LONG_AFTER_SAVE_MS)
    } catch (e) {
      console.error(e)
      alert('No se pudo guardar el miembro. Revisá los datos e intentá de nuevo.')
      setSubmitting(false)
    }
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
          <NewMemberStep1
            data={data}
            errors={errors}
            duplicate={duplicate}
            dismissedDuplicate={dismissedDuplicate}
            tseLoading={tseLoading}
            tseBanner={tseBanner}
            isMinor={isMinor}
            availableCantons={availableCantons}
            availableDistricts={availableDistricts}
            onData={handleData}
            onCedulaBlur={handleCedulaBlur}
            onDismissDuplicate={() => setDismissedDuplicate(true)}
          />
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <NewMemberStep2
            hasFamily={hasFamily}
            onHasFamilyToggle={() => setHasFamily(h => !h)}
            familyMembers={familyMembers}
            addingFamily={addingFamily}
            onSetAddingFamily={setAddingFamily}
            familyCedulaInput={familyCedulaInput}
            onFamilyCedulaInputChange={(val) => { setFamilyCedulaInput(val); setFamilyLookup({ state: 'idle' }) }}
            onFamilyCedulaBlur={handleFamilyCedulaBlur}
            familyLookup={familyLookup}
            newFamilyManual={newFamilyManual}
            onNewFamilyManualChange={(updates) => setNewFamilyManual(f => ({ ...f, ...updates }))}
            familyManualErrors={familyManualErrors}
            isFamilyMinor={isFamilyMinor}
            parentLastName={data.last_name}
            onAddFamilyMember={addFamilyMemberToList}
            onResetFamilyForm={resetFamilyForm}
            onRemoveFamilyMember={removeFamilyMember}
            familyItemName={familyItemName}
            familyItemInitials={familyItemInitials}
            familyItemRelation={familyItemRelation}
          />
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <NewMemberStep3
            data={data}
            isMinor={isMinor}
            familyMembers={familyMembers}
            sendWhatsapp={sendWhatsapp}
            onSendWhatsappChange={setSendWhatsapp}
            sendEmail={sendEmail}
            onSendEmailChange={setSendEmail}
            submitting={submitting}
            onSubmit={handleSubmit}
            familyItemName={familyItemName}
            familyItemInitials={familyItemInitials}
            familyItemRelation={familyItemRelation}
          />
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

'use client'

import { use, useState } from 'react'
import { useToast } from '@/components/shared/Toast'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import { invalidateStudyPlans } from '@/hooks/useStudyPlans'
import { useAuth } from '@/hooks/useAuth'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { X, ChevronLeft } from 'lucide-react'
import type { StudyType } from '@/types/study'
import { CURRENCIES, currencySymbol } from '@/lib/format'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[11px] text-navy-light/60 font-display'

function Toggle({ checked, onChange, label, sublabel }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sublabel?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-navy font-body">{label}</p>
        {sublabel && <p className="text-[11px] text-navy-light/60 mt-0.5 font-body">{sublabel}</p>}
      </div>
      <label className="toggle shrink-0 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label} />
        <div className="toggle-track" />
      </label>
    </div>
  )
}

const STAGE_LABEL: Record<StudyType['stage'], string> = {
  niveles: 'Niveles', inicial: 'Inicial', intermedia: 'Intermedia', avanzada: 'Avanzada', campaña: 'Campaña',
}

export default function EditarEstudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: code } = use(params)
  const { hasRole, loaded } = useAuth()
  const { studyTypes, loading } = useStudies('plans')

  // Editar tipos de estudio: solo roles de estudios (protección por URL).
  if (loaded && !hasRole(...STUDY_ADMIN_ROLES)) return <AccessDenied />

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
      </div>
    )
  }

  const studyType = studyTypes.find(s => s.code === code)
  if (!studyType) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Editar estudio
        </h1>
        <p className="text-navy-light/60 font-body">Estudio no encontrado.</p>
      </div>
    )
  }

  return <EditarForm studyType={studyType} />
}

function EditarForm({ studyType }: { studyType: StudyType }) {
  const router = useRouter()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name:             studyType.name,
    weeks:            studyType.weeks,
    mentor_id:        studyType.mentor_id ?? '',
    mentor_name:      studyType.mentor_name ?? '',
    description:      studyType.description ?? '',
    commitments:      studyType.commitments ?? '',
    difficulty:       studyType.difficulty ?? '',
    requires_payment: studyType.requires_payment,
    cost:             studyType.cost,
    currency:         studyType.currency ?? 'CRC',
    req_donor:        studyType.req_donor,
    req_server:       studyType.req_server,
    req_attendee:     studyType.req_attendee,
    req_bus:          studyType.req_bus ?? false,
    requires_grade:   studyType.requires_grade,
    requires_invitation: studyType.requires_invitation ?? false,
    auto_promote:     studyType.auto_promote,
    is_archived:      studyType.is_archived,
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(p => ({ ...p, [key]: value }))

  async function handleSave() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/studies/plans/${studyType.plan_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          duration_weeks: form.weeks || null,
          mentor_id: form.mentor_id || null,
          description: form.description || null,
          commitments: form.commitments || null,
          difficulty: form.difficulty || null,
          requires_payment: form.requires_payment,
          cost: form.requires_payment ? form.cost : 0,
          currency: form.currency,
          requires_donor: form.req_donor,
          requires_server: form.req_server,
          requires_attendance: form.req_attendee,
          requires_bus_talk: form.req_bus,
          requires_grade: form.requires_grade,
          requires_invitation: form.requires_invitation,
          auto_promote: form.auto_promote,
          is_active: !form.is_archived,
        }),
      })
      if (!res.ok) throw new Error('Error guardando los cambios')
      invalidateStudyPlans()
      router.push('/estudios/plan')
      router.refresh()
    } catch (e) {
      console.error(e)
      toast('No se pudieron guardar los cambios. Intentá de nuevo.', 'error')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Volver
      </button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
            Editar estudio
          </h1>
          <p className="mt-1 text-sm text-navy-light/60 font-body">
            {studyType.code} · {STAGE_LABEL[studyType.stage]}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors disabled:opacity-40 font-body"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            className="rounded-full bg-coral px-5 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Full-width: dos cards lado a lado en desktop (layout.md) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">

        {/* Información básica */}
        <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
          <h2 className="text-sm font-semibold text-navy font-display">Información básica</h2>
          <div className="mt-4 flex flex-col gap-4">

            <div className="space-y-1">
              <label className={labelCls} htmlFor="edit-study-name">Nombre del estudio *</label>
              <input id="edit-study-name" className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls} htmlFor="edit-study-weeks">Duración (semanas)</label>
                <input id="edit-study-weeks" type="number" min={1} max={52} className={inputCls} value={form.weeks} onChange={e => set('weeks', Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className={labelCls} htmlFor="edit-study-difficulty">Dificultad</label>
                <select id="edit-study-difficulty" className={inputCls} value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
                  <option value="">Sin dificultad</option>
                  <option value="Básico">Básico</option>
                  <option value="Intermedio">Intermedio</option>
                  <option value="Avanzado">Avanzado</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <span className={labelCls}>Dirigente encargado</span>
              {form.mentor_id ? (
                <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2">
                  <span className="flex-1 text-sm text-navy font-body">{form.mentor_name || 'Dirigente asignado'}</span>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, mentor_id: '', mentor_name: '' }))}
                    className="inline-flex items-center gap-1 text-[12px] text-coral hover:text-coral-deep transition-colors font-body"
                  >
                    <X size={13} /> Quitar
                  </button>
                </div>
              ) : (
                <MemberCombobox
                  dropdown
                  placeholder="Buscar miembro por nombre o cédula…"
                  onSelect={(m: MemberHit) =>
                    setForm(p => ({ ...p, mentor_id: m.id, mentor_name: `${m.first_name} ${m.last_name}`.trim() }))
                  }
                />
              )}
            </div>

            <div className="space-y-1">
              <label className={labelCls} htmlFor="edit-study-description">Descripción pública</label>
              <textarea id="edit-study-description" className={`${inputCls} resize-y`} rows={4} placeholder="Descripción visible para los miembros..." value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className={labelCls} htmlFor="edit-study-commitments">Compromisos requeridos</label>
              <input id="edit-study-commitments" className={inputCls} placeholder="ej. Tareas semanales, examen final..." value={form.commitments} onChange={e => set('commitments', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Configuración */}
        <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
          <h2 className="text-sm font-semibold text-navy font-display">Configuración</h2>
          <div className="mt-4 flex flex-col gap-4">

            <Toggle checked={form.requires_payment} onChange={v => set('requires_payment', v)} label="¿Requiere pago?" />
            {form.requires_payment && (
              <div className="flex gap-3 pl-4">
                <div className="space-y-1 max-w-[220px]">
                  <label className={labelCls} htmlFor="edit-study-cost">Monto ({currencySymbol(form.currency)})</label>
                  <input id="edit-study-cost" type="number" className={inputCls} value={form.cost} onChange={e => set('cost', Number(e.target.value))} />
                </div>
                {/* INT-2: moneda del costo (el pago de matrícula la hereda). */}
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="edit-study-currency">Moneda</label>
                  <select id="edit-study-currency" className={inputCls} value={form.currency} onChange={e => set('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            <Toggle checked={form.req_donor}      onChange={v => set('req_donor', v)}      label="Requiere ser donador" />
            <Toggle checked={form.req_server}     onChange={v => set('req_server', v)}     label="Requiere servir en un comité" />
            <Toggle checked={form.req_attendee}   onChange={v => set('req_attendee', v)}   label="Requiere asistencia regular a charlas" />
            <Toggle checked={form.req_bus}        onChange={v => set('req_bus', v)}        label="Requiere haber asistido a la charla del Bus" />
            <Toggle checked={form.requires_grade} onChange={v => set('requires_grade', v)} label="Requiere calificación numérica" />
            <Toggle checked={form.requires_invitation} onChange={v => set('requires_invitation', v)} label="Requiere invitación" sublabel="Solo se puede ingresar por invitación (no abierto a inscripción libre)" />
            <Toggle checked={form.auto_promote}   onChange={v => set('auto_promote', v)}   label="Transición automática al siguiente nivel" sublabel="Al cerrar el grupo, pasar automáticamente al siguiente estudio" />
            <Toggle checked={form.is_archived}    onChange={v => set('is_archived', v)}    label="Desactivar estudio" sublabel="No estará disponible para nuevos grupos" />
          </div>
        </div>

      </div>

    </div>
  )
}

'use client'

import { useMemo, useState, useEffect } from 'react'
import { useToast } from '@/components/shared/Toast'
import Link from 'next/link'
import Image from 'next/image'
import { type FormFieldNew, type LogicRule, type FormTemplate } from '@/types/forms'
import { PERSONAL_DATA_FIELDS } from '@/data/form-config'
import { toDomainFormTemplate } from '@/lib/forms/adapter'
import type { Member } from '@/types/member'
import { PublicField } from '@/components/forms/PublicField'
import { FormHero, hasHero } from '@/components/forms/FormHero'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { calcAge } from '@/lib/format'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, User, Pencil } from 'lucide-react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Personal data helpers ─────────────────────────────────────────────────────

function getMemberFieldValue(member: Partial<Member>, key: string): string {
  switch (key) {
    case 'full_name':               return `${member.first_name} ${member.last_name}`
    case 'cedula':                  return member.cedula || '—'
    case 'age':                     return member.birth_date ? `${calcAge(member.birth_date)} años` : '—'
    case 'gender':                  return member.gender === 'M' ? 'Masculino' : member.gender === 'F' ? 'Femenino' : 'No indica'
    case 'marital_status':          return member.marital_status || '—'
    case 'phone':                   return member.phone || '—'
    case 'email':                   return member.email || '—'
    case 'address':                 return member.address || '—'
    case 'emergency_contact_name':  return member.emergency_contact_name || '—'
    case 'emergency_contact_phone': return member.emergency_contact_phone || '—'
    case 'occupation':              return member.occupation || '—'
    case 'workplace':               return member.workplace || '—'
    case 'allergies':               return member.allergies || '—'
    default:                        return '—'
  }
}

// Miembro de ejemplo para la vista previa: muestra cómo se ven los campos que
// se autocompletan desde el perfil. No es dato real, solo un preview.
const PREVIEW_MEMBER: Partial<Member> = {
  first_name: 'María', last_name: 'Rojas Vargas',
  cedula: '1-1234-5678', birth_date: '1990-05-12', gender: 'F',
  marital_status: 'Casada', phone: '8888-8888', email: 'maria.rojas@ejemplo.cr',
  address: 'San José, Costa Rica', emergency_contact_name: 'Carlos Rojas',
  emergency_contact_phone: '8777-7777', occupation: 'Docente',
  workplace: 'MEP', allergies: 'Ninguna',
}

// ─── Logic evaluation ─────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | string[] | number>

function evaluateRule(rule: LogicRule, answers: AnswerMap): boolean {
  const results = rule.conditions.map(condition => {
    const answer = answers[condition.field_id]
    const val = condition.value
    switch (condition.operator) {
      case 'eq': return String(answer ?? '') === val
      case 'neq': return String(answer ?? '') !== val
      case 'contains':
        if (Array.isArray(answer)) return answer.includes(val)
        return String(answer ?? '').toLowerCase().includes(val.toLowerCase())
      case 'not_contains':
        if (Array.isArray(answer)) return !answer.includes(val)
        return !String(answer ?? '').toLowerCase().includes(val.toLowerCase())
      case 'is_empty': return !answer || answer === '' || (Array.isArray(answer) && answer.length === 0)
      case 'is_not_empty': return !!answer && answer !== '' && (!Array.isArray(answer) || answer.length > 0)
      case 'gt': return Number(answer) > Number(val)
      case 'lt': return Number(answer) < Number(val)
      default: return false
    }
  })
  const met = rule.condition_operator === 'AND' ? results.every(Boolean) : results.some(Boolean)
  return met
}

function isFieldVisible(field: FormFieldNew, answers: AnswerMap): boolean {
  const rules = field.logic_rules ?? []
  if (rules.length === 0) return true
  for (const rule of rules) {
    const met = evaluateRule(rule, answers)
    if (rule.action === 'hide' && met) return false
    if (rule.action === 'show' && met) return true
  }
  const hasShowRules = rules.some(r => r.action === 'show')
  return !hasShowRules
}

// ─── Multi-step helpers ───────────────────────────────────────────────────────

function splitIntoPages(fields: FormFieldNew[]): FormFieldNew[][] {
  const pages: FormFieldNew[][] = [[]]
  for (const f of fields) {
    if (f.type === 'page_break') {
      pages.push([])
    } else {
      pages[pages.length - 1].push(f)
    }
  }
  return pages
}

function getPageBreakForPage(fields: FormFieldNew[], pageIndex: number): FormFieldNew | null {
  let count = 0
  for (const f of fields) {
    if (f.type === 'page_break') {
      count++
      if (count === pageIndex) return f
    }
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Pantalla de llenado de un formulario, compartida por dos rutas:
 *  · mode 'fill'    → /formularios/[id]/responder — llenado REAL (cualquier
 *    sesión: es la ruta a la que apuntan las convocatorias por correo).
 *  · mode 'preview' → /formularios/[id]/preview — vista previa del builder:
 *    banner, datos de perfil de ejemplo y NO envía nada.
 * Antes esto era una sola página "preview" que sí guardaba respuestas y que un
 * miembro no podía abrir (exigía el módulo formularios).
 */
export function FormFiller({ formId, mode }: { formId: string; mode: 'fill' | 'preview' }) {
  const toast = useToast()
  const id = formId
  const isPreview = mode === 'preview'
  const { user } = useAuth()
  // Prellenado REAL del perfil (los campos personal_data): en preview se usa el
  // miembro de ejemplo; al llenar de verdad, el perfil de quien responde.
  const [profile, setProfile] = useState<Partial<Member> | null>(null)
  useEffect(() => {
    if (isPreview || !user?.member_id) return
    let alive = true
    fetch(`/api/members/${user.member_id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setProfile(d as Partial<Member>) })
      .catch(() => {})
    return () => { alive = false }
  }, [isPreview, user?.member_id])
  const memberForFields: Partial<Member> = isPreview ? PREVIEW_MEMBER : (profile ?? {})
  // Dedupe: si el formulario no admite múltiples respuestas y ya respondió.
  const [alreadyAnswered, setAlreadyAnswered] = useState(false)
  const [form, setForm] = useState<FormTemplate | null>(null)
  const [loadingForm, setLoadingForm] = useState(true)

  const [answers, setAnswers] = useState<AnswerMap>({})
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  // Invitado: usuario sin sesión. Debe identificar su respuesta con un correo.
  const isGuest = !user
  const [guestEmail, setGuestEmail] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Motivo por el que ESTE formulario no es para esta persona (2026-08-06). Se
  // pregunta al cargar, no al enviar: hacer llenar 24 campos y rechazar al final
  // es la peor forma de decirlo. El guard de verdad vive en el POST.
  const [sinAcceso, setSinAcceso] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // En vista previa no se pregunta: la abre quien administra el formulario.
    const url = isPreview ? `/api/forms/${id}` : `/api/forms/${id}?fill_access=1`
    fetch(url)
      .then(r => (r.ok ? r.json() : null))
      .then(db => {
        if (!alive) return
        setForm(db ? toDomainFormTemplate(db) : null)
        const acceso = db?.fill_access
        setSinAcceso(acceso && acceso.allowed === false ? String(acceso.reason) : null)
        setLoadingForm(false)
      })
      .catch(() => { if (alive) setLoadingForm(false) })
    return () => { alive = false }
  }, [id, isPreview])

  // Dedupe (una respuesta por persona salvo que el form admita varias):
  // allow_multiple_responses existía en el esquema pero nadie lo leía.
  useEffect(() => {
    if (isPreview || !user?.member_id || !form || form.allow_multiple_responses) return
    let alive = true
    fetch(`/api/forms/${id}/responses?mine=1`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setAlreadyAnswered(!!d?.answered) })
      .catch(() => {})
    return () => { alive = false }
  }, [isPreview, user?.member_id, form, id])

  const pages = useMemo(() => splitIntoPages(form?.fields ?? []), [form?.fields])

  if (loadingForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-low">
        <p className="text-sm text-navy-light/60 font-body">Cargando…</p>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/60 font-body">Formulario no encontrado.</p>
      </div>
    )
  }

  // Este formulario no es para esta persona: se dice acá, antes de las preguntas.
  if (sinAcceso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-low">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-surface-card flex items-center justify-center mx-auto shadow-[var(--shadow-md)]">
            <AlertTriangle size={26} className="text-navy-light/60" />
          </div>
          <h1 className="text-xl font-extrabold text-navy font-display tracking-[-0.02em]">
            {form.name}
          </h1>
          <p className="text-sm text-navy-light/70 font-body leading-relaxed">{sinAcceso}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-navy px-5 py-2.5 text-sm text-white hover:bg-navy/80 transition-colors font-body"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    )
  }

  if (alreadyAnswered && !submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-low">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={28} className="text-teal-deep" />
          </div>
          <h2 className="text-2xl font-extrabold text-navy font-display tracking-[-0.02em]">Ya respondiste este formulario</h2>
          <p className="text-sm text-navy-light/60 font-body">
            Tu respuesta quedó registrada. Si necesitás corregir algo, escribinos y lo revisamos.
          </p>
        </div>
      </div>
    )
  }

  const isMultiStep = pages.length > 1
  const tieneHero = hasHero(form)
  const totalPages = pages.length
  const isLastPage = currentPage === totalPages - 1
  const progress = totalPages > 1 ? Math.round(((currentPage + 1) / totalPages) * 100) : 100

  const currentPageBreak = isMultiStep && currentPage > 0
    ? getPageBreakForPage(form.fields, currentPage)
    : null

  function setAnswer(fieldId: string, value: string | string[] | number) {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
    setErrors(prev => prev.filter(e => e !== fieldId))
  }

  function getRequiredErrorsForPage(pageIndex: number): string[] {
    return pages[pageIndex]
      .filter(f => f.type !== 'section' && f.type !== 'personal_data' && f.is_required && isFieldVisible(f, answers))
      .filter(f => {
        const ans = answers[f.id]
        return ans === undefined || ans === '' || (Array.isArray(ans) && ans.length === 0)
      })
      .map(f => f.id)
  }

  function handleNext() {
    const errs = getRequiredErrorsForPage(currentPage)
    if (errs.length > 0) { setErrors(errs); return }
    setErrors([])
    setCurrentPage(p => Math.min(p + 1, totalPages - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePrev() {
    setErrors([])
    setCurrentPage(p => Math.max(p - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    const errs = getRequiredErrorsForPage(currentPage)
    if (errs.length > 0) { setErrors(errs); return }
    setSubmitError(null)
    if (isPreview) {
      // Vista previa: no se guarda nada (antes SÍ guardaba, contradiciendo su
      // propio banner).
      toast('Vista previa: la respuesta no se guardó.', 'success')
      return
    }

    // Construir identidad del que responde.
    // Autenticado con member → member_id. Autenticado sin member → su correo.
    // Invitado → correo obligatorio y con formato válido.
    let identity: { member_id?: string; guest_name?: string; guest_email?: string }
    if (user?.member_id) {
      identity = { member_id: user.member_id }
    } else if (user?.email) {
      // Sesión sin miembro vinculado: el nombre sale del perfil si existe,
      // NUNCA del miembro de ejemplo (antes guardaba "María Rojas Vargas").
      const nombre = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
      identity = { guest_name: nombre || user.name || 'Usuario', guest_email: user.email }
    } else {
      const email = guestEmail.trim()
      if (!EMAIL_RE.test(email)) {
        setSubmitError('Ingresá un correo electrónico válido para identificar tu respuesta.')
        return
      }
      identity = { guest_name: 'Invitado', guest_email: email }
    }

    try {
      const res = await fetch(`/api/forms/${id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identity, answers }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        // El formulario no es para esta persona (2026-08-06): el motivo es
        // legible y hay que mostrarlo tal cual, no taparlo con el genérico.
        if (res.status === 403 && detail?.code === 'formulario_no_asignado') {
          setSubmitError(String(detail.error))
          return
        }
        console.error('Error al enviar formulario:', res.status, detail)
        setSubmitError('Ocurrió un error al enviar el formulario. Verificá tu correo e intentá de nuevo.')
        return
      }
    } catch (err) {
      console.error('Error de red al enviar formulario:', err)
      setSubmitError('Ocurrió un error al enviar el formulario. Verificá tu correo e intentá de nuevo.')
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-low">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="h-16 w-16 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={28} className="text-teal-deep" />
          </div>
          <h2 className="text-2xl font-extrabold text-navy font-display tracking-[-0.02em]">
            ¡Respuesta enviada!
          </h2>
          <p className="text-sm text-navy-light/60 font-body">
            Gracias por completar el formulario. Tu respuesta fue registrada correctamente.
          </p>
          {(isPreview || form.allow_multiple_responses) && (
            <button
              type="button"
              onClick={() => { setSubmitted(false); setAnswers({}); setCurrentPage(0) }}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Enviar otra respuesta
            </button>
          )}
        </div>
      </div>
    )
  }

  const fieldsToRender = pages[currentPage] ?? []

  return (
    <div className="min-h-screen bg-surface-low">
      {/* Banner SOLO en vista previa (y ahora es cierto: no guarda nada). */}
      {isPreview && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-amber-500">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-white" />
            <span className="text-[12px] font-semibold text-white font-display">
              VISTA PREVIA — las respuestas no se guardan
            </span>
          </div>
          <Link
            href={`/formularios/${id}`}
            className="flex items-center gap-1 text-[12px] text-white/80 hover:text-white transition-colors font-body"
          >
            <ChevronLeft size={13} />
            Volver al editor
          </Link>
        </div>
      )}

      <div className="px-4 py-10">
        <div
          className="w-full max-w-lg mx-auto rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]"
        >
          {/* FRM-2 · Encabezado con flyer. Con hero manda el hero: la imagen va
              al borde de la tarjeta y el título sale de ahí (o del nombre del
              formulario si no se puso uno). Sin hero, todo se ve igual que antes. */}
          <FormHero hero={form} fallbackTitle={form.name} />

          {/* Form header */}
          <div className={cn('px-5 sm:px-8 pb-6 border-b border-[var(--outline-variant)]', tieneHero ? 'pt-4' : 'pt-8')}>
            {!tieneHero && (
              <>
                <div className="flex justify-center mb-6">
                  <Image src="/logo-theos-white.png" alt="Theos Place" width={100} height={28} className="object-contain opacity-60" />
                </div>
                <h1 className="text-2xl font-extrabold text-navy text-center font-display tracking-[-0.02em]">
                  {form.name}
                </h1>
              </>
            )}
            {form.description && (
              <p className="text-sm text-navy-light/60 mt-2 text-center leading-relaxed font-body">
                {form.description}
              </p>
            )}

            {/* Multi-step progress */}
            {isMultiStep && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-navy-light/60 font-body">
                    Página {currentPage + 1} de {totalPages}
                  </span>
                  <span className="text-[12px] font-semibold text-coral font-mono">
                    {progress}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-navy/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-coral transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {currentPageBreak?.label && (
                  <p className="text-sm font-bold text-navy mt-1 font-display">
                    {currentPageBreak.label}
                  </p>
                )}
                {currentPageBreak?.description && (
                  <p className="text-[12px] text-navy-light/60 font-body">
                    {currentPageBreak.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="px-5 sm:px-8 py-6 space-y-6">
            {fieldsToRender.map(field => {
              if (!isFieldVisible(field, answers)) return null

              // personal_data → custom card, no label/input wrapper
              if (field.type === 'personal_data') {
                const selectedFields = PERSONAL_DATA_FIELDS.filter(f => (field.options ?? []).includes(f.key))
                if (selectedFields.length === 0) return null
                return (
                  <div
                    key={field.id}
                    className="bg-[rgba(112,189,194,.06)] border border-[rgba(112,189,194,.3)] rounded-[14px] py-4 px-[18px]"
                  >
                    <div className="flex items-start justify-between mb-[14px]">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <User size={14} color="#2a8b8f" />
                          <span className="text-[13px] font-bold text-[#2a8b8f] font-display">
                            Tus datos personales
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--fg-muted,#8c8fb0)] font-body">
                          Tomados de tu perfil — no editables acá
                        </div>
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
                        onClick={() => toast('Redirigir al perfil del miembro para editar datos', 'info')}
                      >
                        <Pencil size={11} />
                        Editar mis datos
                      </button>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
                      {selectedFields.map(f => (
                        <div
                          key={f.key}
                          className="bg-surface-card border border-[var(--outline-variant)] rounded-lg py-2 px-3"
                        >
                          <div className="text-[10px] text-[var(--fg-muted,#8c8fb0)] uppercase tracking-[.05em] font-display">
                            {f.label}
                          </div>
                          <div className="text-[13px] font-semibold mt-[3px] font-body">
                            {getMemberFieldValue(memberForFields, f.key)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }

              const hasError = errors.includes(field.id)

              return (
                <div
                  key={field.id}
                  className={cn('space-y-2 form-field-enter', field.type === 'section' && 'pt-2')}
                  style={{ animation: 'slideDown 200ms ease-out' }}
                >
                  {/* 'info' queda fuera, igual que 'section': su título lo pinta
                      PublicField DENTRO del recuadro. Pintarlo también acá lo
                      duplicaba (bug 2026-08-07). Además un <label> ahí sería
                      semánticamente falso: el bloque no tiene ningún input. */}
                  {field.type !== 'section' && field.type !== 'info' && (
                    <label className="block font-body">
                      <span className="text-sm font-semibold text-navy">
                        {field.label}
                        {field.is_required && <span className="ml-1 text-coral">*</span>}
                      </span>
                      {field.helper_text && (
                        <span className="block text-[12px] text-navy-light/60 mt-0.5">{field.helper_text}</span>
                      )}
                    </label>
                  )}

                  <PublicField
                    field={field}
                    value={answers[field.id]}
                    onChange={val => setAnswer(field.id, val)}
                  />

                  {hasError && (
                    <p className="text-[11px] text-coral font-body">
                      Este campo es obligatorio.
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer actions */}
          <div className="px-5 sm:px-8 pb-8">
            {/* Correo obligatorio para invitados (sin sesión) — identifica la respuesta */}
            {isGuest && isLastPage && (
              <div className="mb-5">
                <label className="block text-sm font-semibold text-navy mb-1.5 font-body">
                  Correo electrónico <span className="text-coral">*</span>
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={e => { setGuestEmail(e.target.value); setSubmitError(null) }}
                  placeholder="Tu correo para identificar tu respuesta"
                  className="w-full rounded-2xl border px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-coral/30 border-[var(--outline-variant)] font-body"
                />
              </div>
            )}

            {submitError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-coral/5 border border-coral/20 px-4 py-3">
                <AlertTriangle size={14} className="text-coral shrink-0" />
                <p className="text-[12px] text-coral font-body">
                  {submitError}
                </p>
              </div>
            )}

            {errors.length > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-coral/5 border border-coral/20 px-4 py-3">
                <AlertTriangle size={14} className="text-coral shrink-0" />
                <p className="text-[12px] text-coral font-body">
                  Por favor completá los campos obligatorios marcados en rojo.
                </p>
              </div>
            )}

            {isMultiStep ? (
              <div className="flex items-center gap-3">
                {currentPage > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex items-center gap-1.5 rounded-2xl border px-5 py-3 text-sm font-semibold text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
                  >
                    <ChevronLeft size={15} />
                    Anterior
                  </button>
                )}
                {!isLastPage ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors font-body"
                  >
                    Siguiente
                    <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors font-body"
                  >
                    Enviar respuesta
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full rounded-2xl bg-coral py-3.5 text-sm font-semibold text-white hover:bg-coral-deep transition-colors font-body"
              >
                Enviar respuesta
              </button>
            )}

            <p className="text-center text-[11px] text-navy-light/60 mt-3 font-body">
              Theos Place · {form.name}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

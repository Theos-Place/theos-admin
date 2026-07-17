'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  GraduationCap, Search, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Calendar, DollarSign, X, AlertCircle, Loader2, Check,
  BookOpen, ArrowRight, Sparkles,
} from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox } from '@/components/shared/MemberCombobox'
import { PaymentMethodSelector, type PaymentMethodValue } from '@/components/shared/PaymentMethodSelector'
import { ScholarshipRequestModal } from '@/components/finance/ScholarshipRequestModal'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import type { EligibilityResult, EligibleGroup, MemberStudyProfile } from '@/lib/studies/eligibility'
import type { StudyType } from '@/types/study'
import { ATTENDANCE_MIN_CHARLAS, ATTENDANCE_MONTHS, ATTENDANCE_RECENCY_DAYS } from '@/lib/attendance'
import { formatDateLong } from '@/lib/format'

type FilterTab = 'all' | 'available' | 'niveles' | 'inicial' | 'intermedia' | 'campaña'

const STAGE_ORDER: FilterTab[] = ['niveles', 'inicial', 'intermedia', 'campaña']

const STAGE_META: Record<string, { label: string; bg: string; text: string }> = {
  niveles:    { label: 'Niveles',          bg: 'rgba(41,54,92,0.08)',      text: '#29365C' },
  inicial:    { label: 'Etapa Inicial',    bg: 'rgba(181,221,224,0.35)',   text: '#519DA2' },
  intermedia: { label: 'Etapa Intermedia', bg: 'rgba(239,85,84,0.12)',     text: '#D94241' },
  'campaña':  { label: 'Campañas',         bg: 'rgba(155,127,212,0.15)',   text: '#7C5EC2' },
}

// Campañas se agrega dinámicamente solo si hay grupos de campaña abiertos.
const FILTER_TABS_BASE: { id: FilterTab; label: string }[] = [
  { id: 'all',         label: 'Todos' },
  { id: 'niveles',     label: 'Niveles' },
  { id: 'inicial',     label: 'Etapa Inicial' },
  { id: 'intermedia',  label: 'Etapa Intermedia' },
]

function formatCRC(amount: number): string {
  return `₡${amount.toLocaleString('es-CR')}`
}

type ConfirmState = { group: EligibleGroup; study: EligibilityResult }

export default function MatriculaPage() {
  const router = useRouter()

  const { user } = useAuth()
  const { studyTypes } = useStudyPlans()
  const userRoles = user?.roles ?? []
  const isAdminView = userRoles.some(r => ['admin', 'direccion'].includes(r))

  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null)
  const effectiveMemberId = selectedMember?.id ?? user?.member_id ?? null
  const effectiveName = selectedMember?.name ?? user?.name ?? 'miembro'

  const [activeFilter, setActiveFilter]   = useState<FilterTab>('all')
  const [search, setSearch]               = useState('')
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null)
  const [confirmModal, setConfirmModal]   = useState<ConfirmState | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('sinpe')
  const [enrolling, setEnrolling]         = useState(false)
  const [pendingReceipt, setPendingReceipt] = useState<{ enrollmentId: string; studyName: string; amount: number } | null>(null)
  const [scholarshipTarget, setScholarshipTarget] = useState<{ entity_type: 'study_plan'; id: string; name: string } | null>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const [eligibilityResults, setEligibilityResults] = useState<EligibilityResult[]>([])
  const [profile, setProfile] = useState<MemberStudyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  // Elegibilidad + perfil académico desde datos reales.
  useEffect(() => {
    if (!effectiveMemberId) { setLoading(false); return }
    let alive = true
    setLoading(true)
    setLoadError(false)
    fetch(`/api/matricula/eligibility?member_id=${effectiveMemberId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => {
        if (!alive) return
        setEligibilityResults(d?.eligibility ?? [])
        setProfile(d?.profile ?? null)
        setLoading(false)
      })
      .catch(() => { if (alive) { setLoadError(true); setLoading(false) } })
    return () => { alive = false }
  }, [effectiveMemberId, retryKey])

  // Solo se ofrecen los estudios con grupos abiertos y matriculables para el
  // miembro. El plan completo (con descripciones) vive en /estudios/plan.
  const availableResults = useMemo(
    () => eligibilityResults.filter(r => r.is_eligible && r.available_groups.length > 0),
    [eligibilityResults],
  )

  const hasCampaignGroups = availableResults.some(r => r.stage === 'campaña')
  const filterTabs = hasCampaignGroups
    ? [...FILTER_TABS_BASE, { id: 'campaña' as FilterTab, label: 'Campañas' }]
    : FILTER_TABS_BASE

  const filteredResults = useMemo(() => {
    let res = availableResults
    if (activeFilter !== 'all' && activeFilter !== 'available') {
      res = res.filter(r => r.stage === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      res = res.filter(r =>
        r.study_name.toLowerCase().includes(q) ||
        r.study_code.toLowerCase().includes(q)
      )
    }
    return res
  }, [availableResults, activeFilter, search])

  const grouped = STAGE_ORDER
    .map(stage => ({ stage, items: filteredResults.filter(r => r.stage === stage) }))
    .filter(g => g.items.length > 0)

  // Cuando una etapa (tab específico) no tiene nada matriculable, explicamos por
  // qué en vez de dejarlo vacío — reutiliza reasons_met/reasons_blocked que ya
  // calcula computeEligibility, sin reimplementar ningún requisito.
  const stageResultsForEmptyState = useMemo(() => {
    if (activeFilter === 'all' || activeFilter === 'available') return null
    return eligibilityResults.filter(r => r.stage === activeFilter)
  }, [eligibilityResults, activeFilter])

  // Métricas del perfil (datos reales)
  const completedStudies = studyTypes.filter(s => profile?.completed_codes.includes(s.code))
  const currentStudyInfo = studyTypes.find(s => s.code === profile?.current_code)
  const isDonor = profile?.is_donor ?? false
  const isActiveServer = profile?.is_server ?? false
  const charlaCount = profile?.charla_count ?? 0
  const attendanceActive = profile?.attendance_active ?? false
  const availableCount = eligibilityResults.filter(r => r.is_eligible && r.available_groups.length > 0).length

  async function handleEnroll(scholarship?: { scholarship_id?: string; coupon_code?: string }) {
    if (!confirmModal || !effectiveMemberId || enrolling) return
    const { group, study } = confirmModal
    setEnrolling(true)
    try {
      const res = await fetch(`/api/studies/groups/${group.group_id}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: effectiveMemberId, ...scholarship }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setConfirmModal(null)
      if (data?.status === 'pendiente_de_pago') {
        // Con costo: pedir el comprobante en el momento, no solo mandar a la
        // pantalla de éxito (la matrícula no queda activa hasta que se apruebe).
        setPendingReceipt({ enrollmentId: data.enrollment_id, studyName: study.study_name, amount: data.amount })
        setEnrolling(false)
      } else {
        router.push(`/matricula/confirmacion?group=${group.group_id}&study=${study.study_code}`)
      }
    } catch (err) {
      console.error('No se pudo matricular:', err)
      setEnrollError(err instanceof Error ? err.message : 'No se pudo matricular.')
      setEnrolling(false)
    }
  }

  if (!effectiveMemberId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-navy-light/60 font-body">
          No hay un miembro asociado a tu cuenta.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header strip */}
      <div
        className="rounded-2xl px-6 py-5 bg-navy shadow-card"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap size={18} className="text-white/60" />
              <span className="text-xs uppercase tracking-widest text-white/70 font-display">
                Portal de Matrícula
              </span>
            </div>
            <h1
              className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]"
            >
              Matrícula de Estudios
            </h1>
            <p className="mt-0.5 text-sm text-white/60 font-body">
              Hola, <span className="text-white font-medium">{effectiveName}</span>
              {' · '}{availableCount} estudio{availableCount !== 1 ? 's' : ''} disponible{availableCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Selector de miembro — solo admin/direccion */}
          {isAdminView && (
            <MemberPicker
              selected={selectedMember}
              onSelect={m => { setSelectedMember(m); setExpandedStudy(null) }}
            />
          )}
        </div>
      </div>

      {/* Perfil académico */}
      <div
        className="rounded-2xl px-5 py-4 bg-surface-card shadow-card"
      >
        <p className="text-[10px] uppercase tracking-widest text-navy-light/60 mb-3 font-display">
          Perfil académico
        </p>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 space-y-2.5">
            {/* Estudios completados */}
            <div>
              <p className="text-[11px] text-navy-light/60 mb-1.5 font-body">
                Estudios completados ({completedStudies.length})
              </p>
              {completedStudies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {completedStudies.map(s => (
                    <span
                      key={s.code}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-teal-soft/30 text-teal-deep font-display"
                    >
                      {s.code} ✓
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[12px] text-navy-light/60 italic font-body">
                  Ninguno aún
                </span>
              )}
            </div>

            {/* En curso */}
            {currentStudyInfo && (
              <div>
                <p className="text-[11px] text-navy-light/60 mb-1.5 font-body">
                  En curso
                </p>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-coral/15 text-coral font-display"
                >
                  {currentStudyInfo.code} — {currentStudyInfo.name}
                </span>
              </div>
            )}
          </div>

          {/* Compromisos */}
          <div
            className="rounded-xl px-4 py-3 shrink-0 bg-surface-low"
          >
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 mb-2 font-display">
              Compromisos
            </p>
            <div className="space-y-1.5">
              <CommitmentRow met={isDonor}                    label="Donador/a activo/a" />
              <CommitmentRow met={!!isActiveServer}           label="Servidor/a en comité" />
              <CommitmentRow met={attendanceActive} label={`Asistencia activa: ≥${ATTENDANCE_MIN_CHARLAS} charlas en los últimos ${ATTENDANCE_MONTHS} meses, con al menos una en los últimos ${ATTENDANCE_RECENCY_DAYS} días (llevás ${charlaCount})`} />
            </div>
          </div>
        </div>
      </div>

      {/* Acceso al plan de estudios completo — destacado a propósito: es la
          referencia de "qué pide cada estudio", no un link secundario. */}
      <Link
        href="/estudios/plan"
        className="group flex items-center gap-4 rounded-2xl px-6 py-5 border-2 border-coral/25 bg-coral/5 hover:bg-coral/10 hover:border-coral/40 transition-colors"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-coral/15">
          <BookOpen size={22} className="text-coral-deep" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-extrabold text-navy font-display tracking-[-0.01em] flex items-center gap-1.5">
            <Sparkles size={15} className="text-coral shrink-0" />
            Explorá el plan de estudios completo
          </p>
          <p className="text-[13px] text-navy-light/70 font-body">
            Todos los estudios de Theos Place, con los compromisos que pide cada uno — donador, servicio, asistencia y qué estudio va primero.
          </p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-coral transition-transform group-hover:translate-x-1" />
      </Link>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all',
                activeFilter === tab.id
                  ? 'bg-navy text-white border-navy'
                  : 'text-navy-light/60 hover:text-navy border-transparent hover:border-navy/20'
              , 'font-display')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 w-full sm:w-64 focus-within:ring-1 focus-within:ring-coral/30 transition-all">
          <Search size={14} className="text-navy-light/60 shrink-0" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar estudio..."
            aria-label="Buscar estudio"
            className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/50 outline-none font-body"
          />
        </div>
      </div>

      {/* Lista de estudios */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
        </div>
      ) : loadError ? (
        <div
          className="rounded-2xl p-12 text-center bg-surface-card shadow-card border border-coral/30"
        >
          <AlertCircle size={28} className="text-coral mx-auto mb-3" />
          <p className="text-sm font-semibold text-navy font-body">
            No se pudo cargar la matrícula. Probá de nuevo.
          </p>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="mt-4 inline-flex items-center rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            Reintentar
          </button>
        </div>
      ) : grouped.length === 0 ? (
        // Niveles y Campañas no piden compromisos — si el tab queda vacío es
        // por otra razón (sin grupos abiertos), nunca por requisitos.
        stageResultsForEmptyState && stageResultsForEmptyState.length > 0
          && activeFilter !== 'niveles' && activeFilter !== 'campaña' ? (
          <StageRequirementsEmptyState
            stage={activeFilter}
            results={stageResultsForEmptyState}
            studyTypes={studyTypes}
          />
        ) : (
          <div
            className="rounded-2xl p-12 text-center bg-surface-card shadow-card"
          >
            <GraduationCap size={28} className="text-navy-light/60 mx-auto mb-3" />
            <p className="text-sm font-semibold text-navy-light/60 font-body">
              Por ahora no hay grupos abiertos para matricular
            </p>
            <p className="text-[13px] text-navy-light/60 mt-1 font-body">
              Podés reportar tu interés desde tu perfil — el equipo de estudios analiza la demanda para abrir grupos
            </p>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {grouped.map(({ stage, items }) => {
            const meta = STAGE_META[stage] ?? STAGE_META.niveles
            return (
              <div key={stage}>
                {/* Separador de etapa */}
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-bold"
                    style={{ background: meta.bg, color: meta.text, fontFamily: 'var(--font-display)' }}
                  >
                    {meta.label}
                  </span>
                  <div className="flex-1 h-px bg-outline" />
                  <span className="text-[11px] text-navy-light/60 font-body">
                    {items.length} estudio{items.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {items.map(result => (
                    <StudyCard
                      key={result.study_code}
                      result={result}
                      stageMeta={meta}
                      expanded={expandedStudy === result.study_code}
                      onToggleExpand={() => setExpandedStudy(
                        expandedStudy === result.study_code ? null : result.study_code
                      )}
                      onEnroll={group => {
                        setConfirmModal({ group, study: result })
                        setPaymentMethod('sinpe')
                        setEnrollError(null)
                      }}
                      onRequestScholarship={() => {
                        const plan = studyTypes.find(s => s.code === result.study_code)
                        if (plan?.plan_id) setScholarshipTarget({ entity_type: 'study_plan', id: plan.plan_id, name: plan.name })
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmModal && (
        <ConfirmModal
          study={confirmModal.study}
          group={confirmModal.group}
          paymentMethod={paymentMethod}
          onPaymentChange={setPaymentMethod}
          onCancel={() => setConfirmModal(null)}
          onConfirm={handleEnroll}
          enrolling={enrolling}
          error={enrollError}
          memberId={effectiveMemberId}
          planId={studyTypes.find(s => s.code === confirmModal.study.study_code)?.plan_id ?? null}
        />
      )}

      {/* Comprobante de pago inmediato (matrícula con costo, recién creada) */}
      {pendingReceipt && (
        <ReceiptModal
          enrollmentId={pendingReceipt.enrollmentId}
          studyName={pendingReceipt.studyName}
          amount={pendingReceipt.amount}
          onDone={() => setPendingReceipt(null)}
        />
      )}

      {scholarshipTarget && effectiveMemberId && (
        <ScholarshipRequestModal
          memberId={effectiveMemberId}
          fixedTarget={scholarshipTarget}
          onClose={() => setScholarshipTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

// Buscador de miembro para admin/dirección (ver disponibilidad como otra persona).
function MemberPicker({ selected, onSelect }: {
  selected: { id: string; name: string } | null
  onSelect: (m: { id: string; name: string } | null) => void
}) {
  return (
    <div className="flex flex-col gap-1 w-64">
      <label className="text-[10px] uppercase tracking-widest text-white/70 font-display">
        Ver disponibilidad como:
      </label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white">
          <span className="truncate font-body">{selected.name}</span>
          <button onClick={() => onSelect(null)} aria-label="Quitar miembro seleccionado" className="text-white/60 hover:text-white shrink-0"><X size={14} /></button>
        </div>
      ) : (
        <MemberCombobox
          dropdown
          variant="onDark"
          pageSize={6}
          placeholder="Buscar miembro…"
          onSelect={m => onSelect({ id: m.id, name: `${m.first_name} ${m.last_name}` })}
        />
      )}
    </div>
  )
}

// ¿Es este estudio la "puerta de entrada" real de su etapa? — su prerequisito
// no pertenece a la MISMA etapa (o no tiene). Los estudios cuyo prerequisito
// es OTRO estudio de la misma etapa (ej. Discípulos 2 pide Discípulos 1) son
// pasos internos de la cadena, no el mínimo real para entrar a la etapa — si
// se incluyeran, el mensaje agregado mostraría de más (ej. pedir a la vez SCJ,
// Discípulos 1, Discípulos 2 y Panorama para "Etapa Intermedia", cuando el
// único requisito real de entrada es SCJ).
function isStageGateway(r: EligibilityResult, studyTypes: StudyType[]): boolean {
  const study = studyTypes.find(s => s.code === r.study_code)
  if (!study?.prerequisite) return true
  const prereq = studyTypes.find(s => s.code === study.prerequisite)
  return !prereq || prereq.stage !== study.stage
}

// Mensaje de un tab de etapa sin nada matriculable: por qué, y qué le falta a
// ESTA persona puntualmente — a partir de reasons_met/reasons_blocked que ya
// trae cada EligibilityResult (computeEligibility), sin recalcular requisitos.
// Acotado a los estudios "puerta de entrada" de la etapa (ver isStageGateway)
// para no mezclar los prerequisitos internos de la cadena con el mínimo real.
function StageRequirementsEmptyState({ stage, results, studyTypes }: {
  stage: FilterTab; results: EligibilityResult[]; studyTypes: StudyType[]
}) {
  const meta = STAGE_META[stage] ?? STAGE_META.niveles
  const gateway = results.filter(r => isStageGateway(r, studyTypes))
  const met = new Set<string>()
  const blocked = new Set<string>()
  let anyEligible = false
  for (const r of gateway) {
    if (r.is_eligible) anyEligible = true
    r.reasons_met.forEach(m => met.add(m))
    if (!r.is_eligible) r.reasons_blocked.forEach(b => blocked.add(b))
  }

  return (
    <div className="rounded-2xl p-8 bg-surface-card shadow-card">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: meta.bg }}>
          <GraduationCap size={18} style={{ color: meta.text }} />
        </div>
        <div>
          <p className="text-base font-bold text-navy font-display">
            {anyEligible
              ? `Ya cumplís los requisitos de ${meta.label}`
              : `Para acceder a los estudios de ${meta.label} te falta:`}
          </p>
          <p className="text-[13px] text-navy-light/60 font-body mt-0.5">
            {anyEligible
              ? 'Todavía no hay grupos abiertos en este momento — apenas se abra uno vas a poder matricularte.'
              : 'Estos son los compromisos que pide esta etapa.'}
          </p>
        </div>
      </div>

      {(met.size > 0 || blocked.size > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {met.size > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display mb-2">Ya cumplís</p>
              <div className="space-y-1.5">
                {[...met].map((m, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 size={13} className="text-teal-deep shrink-0 mt-0.5" />
                    <span className="text-[13px] text-navy font-body">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {blocked.size > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display mb-2">Te falta</p>
              <div className="space-y-1.5">
                {[...blocked].map((b, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <XCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[13px] text-navy-light/70 font-body">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Link
        href="/estudios/plan"
        className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-coral hover:text-coral-deep transition-colors font-body underline decoration-dotted"
      >
        Ver todos los estudios y sus compromisos <ArrowRight size={13} />
      </Link>
    </div>
  )
}

function CommitmentRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {met
        ? <CheckCircle2 size={13} className="text-teal-deep shrink-0" />
        : <XCircle size={13} className="text-navy-light/60 shrink-0" />
      }
      <span
        className={cn('text-[12px]', met ? 'text-navy' : 'text-navy-light/60', 'font-body')}
      >
        {label}
      </span>
    </div>
  )
}

function StudyCard({
  result, stageMeta, expanded, onToggleExpand, onEnroll, onRequestScholarship,
}: {
  result: EligibilityResult
  stageMeta: { label: string; bg: string; text: string }
  expanded: boolean
  onToggleExpand: () => void
  onEnroll: (group: EligibleGroup) => void
  onRequestScholarship: () => void
}) {
  const studyType = result.available_groups[0]

  return (
    <div
      className={cn('rounded-2xl overflow-hidden transition-opacity', !result.is_eligible && 'opacity-60')}
      style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
    >
      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold rounded px-1.5 py-0.5"
                style={{ background: stageMeta.bg, color: stageMeta.text, fontFamily: 'var(--font-mono)' }}
              >
                {result.study_code}
              </span>
              {!result.is_eligible && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 font-display"
                >
                  Bloqueado
                </span>
              )}
              {result.by_invitation && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-coral/10 text-coral font-display">
                  Por invitación
                </span>
              )}
              {result.by_exception && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-teal-soft/40 text-teal-deep font-display">
                  Excepción autorizada
                </span>
              )}
            </div>
            <p className="mt-1 text-base font-bold text-navy leading-snug font-display">
              {result.study_name}
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0"
            style={{ background: stageMeta.bg, color: stageMeta.text, fontFamily: 'var(--font-display)' }}
          >
            {stageMeta.label}
          </span>
        </div>

        {/* Meta: semanas + costo */}
        <div className="flex items-center gap-3 text-[12px] text-navy-light/60 font-body">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {result.weeks} semanas
          </span>
          {studyType?.requires_payment && studyType.cost ? (
            <span className="flex items-center gap-1 text-coral">
              <DollarSign size={12} />
              {formatCRC(studyType.cost)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-teal-deep">
              <DollarSign size={12} />
              Gratuito
            </span>
          )}
          {studyType?.requires_payment && (studyType.cost ?? 0) > 0 && (
            <button
              type="button"
              onClick={onRequestScholarship}
              className="ml-auto text-[11px] text-coral hover:text-coral-deep transition-colors font-body underline decoration-dotted"
            >
              ¿Necesitás ayuda para pagar? Solicitar beca
            </button>
          )}
        </div>

        {/* Requisitos */}
        <div className="space-y-1">
          {result.is_eligible ? (
            <>
              <p className="text-[11px] text-navy-light/60 font-medium font-display">
                Prerequisitos cumplidos:
              </p>
              {result.reasons_met.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 size={12} className="text-teal-deep shrink-0 mt-0.5" />
                  <span className="text-[12px] text-navy-light/70 font-body">{r}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="text-[11px] text-navy-light/60 font-medium font-display">
                Para poder matricular necesitás:
              </p>
              {result.reasons_blocked.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[12px] text-navy-light/60 font-body">{r}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* CTA */}
        {result.is_eligible && (
          <button
            onClick={onToggleExpand}
            className="w-full flex items-center justify-between gap-2 rounded-xl bg-coral/10 hover:bg-coral/20 px-4 py-2.5 text-[13px] font-medium text-coral transition-colors font-body"
          >
            <span>
              {result.available_groups.length} grupo{result.available_groups.length !== 1 ? 's' : ''} disponible{result.available_groups.length !== 1 ? 's' : ''}
              {result.available_groups.length === 0 && ' — sin cupos'}
            </span>
            <span className="flex items-center gap-1">
              Ver grupos y matricular
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>
        )}
      </div>

      {/* Panel expandido de grupos */}
      {expanded && result.available_groups.length > 0 && (
        <div
          className="border-t border-outline"
        >
          <div className="px-5 py-3">
            <p className="text-[11px] font-semibold text-navy-light/60 uppercase tracking-widest mb-3 font-display">
              Grupos disponibles — {result.study_name}
            </p>
            <div className="space-y-2">
              {result.available_groups.map(group => (
                <GroupRow key={group.group_id} group={group} onEnroll={() => onEnroll(group)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupRow({ group, onEnroll }: { group: EligibleGroup; onEnroll: () => void }) {
  const fillPct = group.max_capacity > 0 ? Math.round((group.filled / group.max_capacity) * 100) : 0

  return (
    <div
      className="rounded-xl px-3 py-3 flex items-center gap-3 flex-wrap bg-surface-low"
    >
      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5">
        <div>
          <p className="text-[10px] text-navy-light/60 uppercase tracking-wider mb-0.5 font-display">Zona</p>
          <p className="text-[13px] font-medium text-navy capitalize font-body flex items-center gap-1.5">
            {group.zone}
            {group.is_virtual && (
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium font-display bg-teal-soft/40 text-teal-deep normal-case">
                Virtual
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-navy-light/60 uppercase tracking-wider mb-0.5 font-display">Horario</p>
          <p className="text-[13px] text-navy font-body">{group.schedule_days} {group.schedule_time}</p>
        </div>
        <div>
          <p className="text-[10px] text-navy-light/60 uppercase tracking-wider mb-0.5 font-display">Dirigente</p>
          <p className="text-[13px] text-navy font-body">{group.leader_name}</p>
        </div>
        <div>
          <p className="text-[10px] text-navy-light/60 uppercase tracking-wider mb-0.5 font-display">Cupos</p>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-navy font-body">
              {group.spots_available}/{group.max_capacity}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-navy-light/10 overflow-hidden min-w-[40px]">
              <div
                className="h-full rounded-full bg-coral transition-all"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[11px] text-navy-light/60 font-body">
          Inicio: {formatDateLong(group.start_date)}
        </span>
        {group.requires_payment && group.cost ? (
          <span className="text-[11px] font-semibold text-coral font-display">
            {formatCRC(group.cost)}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-teal-deep font-display">
            Gratuito
          </span>
        )}
        <button
          onClick={onEnroll}
          className="mt-1 rounded-lg bg-coral px-3 py-1.5 text-[12px] font-medium text-white hover:bg-coral-deep transition-colors font-body"
        >
          Matricular
        </button>
      </div>
    </div>
  )
}

type ApplicableScholarship = { id: string; discount_type: 'percentage' | 'fixed'; discount_value: number }

function ConfirmModal({
  study, group, paymentMethod, onPaymentChange, onCancel, onConfirm, enrolling, error, memberId, planId,
}: {
  study: EligibilityResult
  group: EligibleGroup
  paymentMethod: PaymentMethodValue
  onPaymentChange: (m: PaymentMethodValue) => void
  onCancel: () => void
  onConfirm: (scholarship?: { scholarship_id?: string; coupon_code?: string }) => void
  enrolling: boolean
  error: string | null
  memberId: string | null
  planId: string | null
}) {
  const [applicable, setApplicable] = useState<ApplicableScholarship | null>(null)
  const [useScholarship, setUseScholarship] = useState(true)
  const [couponCode, setCouponCode] = useState('')

  useEffect(() => {
    if (!memberId || !planId || !(group.requires_payment && group.cost)) return
    fetch(`/api/scholarships/applicable?member_id=${memberId}&entity_type=study_plan&entity_id=${planId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setApplicable(d?.scholarship ?? null))
      .catch(() => setApplicable(null))
  }, [memberId, planId, group.requires_payment, group.cost])

  const discountedAmount = applicable && group.cost
    ? Math.max(0, applicable.discount_type === 'percentage'
      ? Math.round(group.cost * (1 - applicable.discount_value / 100))
      : Math.round(group.cost - applicable.discount_value))
    : null

  function handleConfirm() {
    if (applicable && useScholarship) onConfirm({ scholarship_id: applicable.id })
    else if (couponCode.trim()) onConfirm({ coupon_code: couponCode.trim() })
    else onConfirm()
  }

  return (
    <Modal onClose={onCancel} titleId="confirmar-matricula-title" width={448}>
      <div className="p-6 space-y-5">
        {/* Header */}
        <p id="confirmar-matricula-title" className="text-base font-bold text-navy font-display">
          Confirmar matrícula
        </p>

        {/* Detalle */}
        <div className="rounded-xl space-y-0 overflow-hidden border border-outline">
          {[
            { label: 'Estudio',   value: study.study_name },
            { label: 'Grupo',     value: `${group.zone.charAt(0).toUpperCase() + group.zone.slice(1)} — ${group.schedule_days} ${group.schedule_time}` },
            { label: 'Dirigente', value: group.leader_name },
            { label: 'Inicio',    value: formatDateLong(group.start_date) },
            { label: 'Duración',  value: `${study.weeks} semanas` },
            { label: 'Costo',     value: group.requires_payment && group.cost ? formatCRC(group.cost) : 'Gratuito' },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              className={cn('flex items-center gap-3 px-4 py-2.5', i > 0 && 'border-t', 'border-outline')}
            >
              <span className="w-24 text-[11px] text-navy-light/60 uppercase tracking-wider shrink-0 font-display">
                {label}
              </span>
              <span className="text-[13px] font-medium text-navy font-body">
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Aviso */}
        <div
          className="flex items-start gap-2.5 rounded-xl px-3 py-3 bg-coral/7 border border-coral/20"
        >
          <AlertCircle size={14} className="text-coral shrink-0 mt-0.5" />
          <p className="text-[12px] text-navy-light/70 font-body">
            {group.requires_payment && group.cost
              ? 'Al confirmar, te vamos a pedir el comprobante de pago para completar la matrícula.'
              : 'Al confirmar tu matrícula, un administrador procesará tu inscripción y recibirás un mensaje de confirmación.'}
          </p>
        </div>

        {/* Beca: asignada aplicable, o código genérico */}
        {group.requires_payment && group.cost && (
          <div className="space-y-2">
            {applicable ? (
              <label className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-teal-soft/10 border border-teal-deep/20 cursor-pointer">
                <input type="checkbox" checked={useScholarship} onChange={e => setUseScholarship(e.target.checked)} />
                <span className="text-[13px] text-navy font-body">
                  Usar mi beca ({applicable.discount_type === 'percentage' ? `${applicable.discount_value}%` : `₡${applicable.discount_value.toLocaleString('es-CR')}`} de descuento)
                  {discountedAmount != null && <span className="block text-[11px] text-teal-deep font-semibold">Nuevo total: {formatCRC(discountedAmount)}</span>}
                </span>
              </label>
            ) : (
              <div className="space-y-1">
                <label htmlFor="coupon-code" className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">¿Tenés un código de descuento?</label>
                <input
                  id="coupon-code" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Opcional"
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                />
              </div>
            )}
          </div>
        )}

        {/* Método de pago */}
        {group.requires_payment && group.cost && (
          <PaymentMethodSelector value={paymentMethod} onChange={onPaymentChange} />
        )}

        {error && <p className="text-[13px] text-coral font-body">{error}</p>}

        {/* Botones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={enrolling}
            className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-outline font-body"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={enrolling}
            className={cn('flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-medium font-body', enrolling && 'opacity-50 cursor-not-allowed')}
          >
            {enrolling ? 'Matriculando…' : 'Confirmar matrícula'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Comprobante inmediato tras matricular una matrícula con costo (queda
// 'pendiente_de_pago' hasta que se apruebe). Mismo patrón que PayMatriculaButton
// del perfil del miembro, pero abierto de una vez en vez de requerir un click extra.
function ReceiptModal({ enrollmentId, studyName, amount, onDone }: {
  enrollmentId: string; studyName: string; amount: number; onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy || !file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('enrollment_id', enrollmentId)
      fd.append('reference', reference.trim())
      const res = await fetch('/api/payments', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el comprobante.')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  return (
    <Modal onClose={() => !busy && onDone()} titleId="comprobante-matricula-title" width={420}>
      <div className="p-6 space-y-4">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-teal/15">
                <Check size={26} className="text-teal-deep" />
              </div>
            </div>
            <p className="text-base font-bold text-navy font-display">Comprobante enviado</p>
            <p className="text-[13px] text-navy-light/70 font-body">
              Tu matrícula de {studyName} quedó pendiente de aprobación de pago. Te avisamos si hay algún problema.
            </p>
            <button onClick={onDone} className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Listo</button>
          </div>
        ) : (
          <>
            <h3 id="comprobante-matricula-title" className="text-base font-bold text-navy font-display">Pagar matrícula</h3>
            <p className="text-[13px] text-navy-light/70 font-body">
              {studyName} — {formatCRC(amount)}. Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Comprobante (imagen)</label>
              <input
                type="file"
                accept="image/*"
                aria-label="Comprobante de pago"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[12px] file:text-navy"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="mat-pay-ref" className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Número de referencia</label>
              <input
                id="mat-pay-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            {error && <p className="text-[12px] text-coral font-body">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={busy || !file}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar comprobante'}
              </button>
              <button onClick={onDone} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
                Más tarde
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

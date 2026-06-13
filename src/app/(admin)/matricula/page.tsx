'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  GraduationCap, Search, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Calendar, DollarSign, X, AlertCircle,
  CreditCard, Smartphone, BookOpen, ArrowRight,
} from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox } from '@/components/shared/MemberCombobox'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { STUDY_CATALOG } from '@/data/study-catalog'
import { MATRICULA_MIN_CHARLAS, type EligibilityResult, type EligibleGroup, type MemberStudyProfile } from '@/lib/studies/eligibility'
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
  const userRoles = user?.roles ?? []
  const isAdminView = userRoles.some(r => ['admin', 'direccion'].includes(r))

  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null)
  const effectiveMemberId = selectedMember?.id ?? user?.member_id ?? null
  const effectiveName = selectedMember?.name ?? user?.name ?? 'miembro'

  const [activeFilter, setActiveFilter]   = useState<FilterTab>('all')
  const [search, setSearch]               = useState('')
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null)
  const [confirmModal, setConfirmModal]   = useState<ConfirmState | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'sinpe'>('sinpe')
  const [enrolling, setEnrolling]         = useState(false)

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

  // Métricas del perfil (datos reales)
  const completedStudies = STUDY_CATALOG.filter(s => profile?.completed_codes.includes(s.code))
  const currentStudyInfo = STUDY_CATALOG.find(s => s.code === profile?.current_code)
  const isDonor = profile?.is_donor ?? false
  const isActiveServer = profile?.is_server ?? false
  const charlaCount = profile?.charla_count ?? 0
  const availableCount = eligibilityResults.filter(r => r.is_eligible && r.available_groups.length > 0).length

  async function handleEnroll() {
    if (!confirmModal || !effectiveMemberId || enrolling) return
    const { group, study } = confirmModal
    setEnrolling(true)
    try {
      const res = await fetch(`/api/studies/groups/${group.group_id}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: effectiveMemberId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      router.push(`/matricula/confirmacion?group=${group.group_id}&study=${study.study_code}`)
    } catch (err) {
      console.error('No se pudo matricular:', err)
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
              <CommitmentRow met={charlaCount >= MATRICULA_MIN_CHARLAS} label={`Asistencia a charlas, últimos 6 meses (${charlaCount}/${MATRICULA_MIN_CHARLAS})`} />
            </div>
          </div>
        </div>
      </div>

      {/* Acceso al plan de estudios completo */}
      <Link
        href="/estudios/plan"
        className="group flex items-center gap-4 rounded-2xl bg-surface-card px-6 py-5 shadow-card hover:shadow-card-lg transition-shadow"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy/8">
          <BookOpen size={22} className="text-navy" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-extrabold text-navy font-display tracking-[-0.01em]">
            Ver el plan de estudios completo
          </p>
          <p className="text-[13px] text-navy-light/60 font-body">
            Conocé el camino de formación y qué estudio sigue
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
  result, stageMeta, expanded, onToggleExpand, onEnroll,
}: {
  result: EligibilityResult
  stageMeta: { label: string; bg: string; text: string }
  expanded: boolean
  onToggleExpand: () => void
  onEnroll: (group: EligibleGroup) => void
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
          <p className="text-[13px] font-medium text-navy capitalize font-body">{group.zone}</p>
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

function ConfirmModal({
  study, group, paymentMethod, onPaymentChange, onCancel, onConfirm,
}: {
  study: EligibilityResult
  group: EligibleGroup
  paymentMethod: 'card' | 'sinpe'
  onPaymentChange: (m: 'card' | 'sinpe') => void
  onCancel: () => void
  onConfirm: () => void
}) {
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
            Al confirmar tu matrícula, un administrador procesará tu inscripción y recibirás un mensaje de confirmación.
          </p>
        </div>

        {/* Método de pago */}
        {group.requires_payment && group.cost && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
              Método de pago
            </p>
            <div className="space-y-2">
              {([
                { value: 'sinpe', label: 'SINPE Móvil', icon: Smartphone },
                { value: 'card',  label: 'Tarjeta de crédito/débito', icon: CreditCard },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all',
                    paymentMethod === opt.value
                      ? 'bg-navy text-white'
                      : 'bg-surface-low text-navy hover:bg-navy/5'
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={opt.value}
                    checked={paymentMethod === opt.value}
                    onChange={() => onPaymentChange(opt.value)}
                    className="sr-only"
                  />
                  <opt.icon size={15} />
                  <span className="text-[13px] font-body">{opt.label}</span>
                  <div className={cn(
                    'ml-auto h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all',
                    paymentMethod === opt.value ? 'border-white' : 'border-navy-light/30'
                  )}>
                    {paymentMethod === opt.value && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-outline font-body"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-medium font-body"
          >
            Confirmar matrícula
          </button>
        </div>
      </div>
    </Modal>
  )
}

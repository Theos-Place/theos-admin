'use client'

import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { useStudies } from '@/hooks/useStudies'
import { sedeLabel } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { getCurrentBlock, getNextBlock, suggestedGroups } from '@/lib/studies/blocks'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'
import { HandCoins, CalendarCheck, HeartHandshake, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

type DemandRow = {
  zone: string
  graduating: number
  eligible: number
  graduating_members: string[]
  eligible_members: string[]
}
type Analysis = {
  rows: DemandRow[]
  totalGraduating: number
  totalEligible: number
  totalDemand: number
  suggestedGroups: number
  currentBlock: { block: number; label: string }
  nextBlock: { block: number; label: string; startsAt: string; enrollmentOpens: string }
  studyInfo: {
    code: string
    name: string
    weeks: number
    stage: string
    prerequisite: string | null
    requirements: string[]
  }
}

const REQ_META: Record<string, { label: string; Icon: React.ElementType }> = {
  donante:    { label: 'Donante',    Icon: HandCoins },
  asistencia: { label: 'Asistencia', Icon: CalendarCheck },
  servidor:   { label: 'Servidor',   Icon: HeartHandshake },
}

function formatDateLong(d: Date) {
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long' })
}

/** Chips de requisitos: coloreados si aplican al estudio, apagados si no. */
function RequirementChips({ requirements, size = 'md' }: { requirements: string[]; size?: 'sm' | 'md' }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {Object.entries(REQ_META).map(([key, { label, Icon }]) => {
        const active = requirements.includes(key)
        return (
          <span
            key={key}
            className={cn(
              'inline-flex items-center gap-1 rounded-full font-body',
              size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[13px]',
              active ? 'bg-teal/15 text-teal-deep font-medium' : 'bg-surface-low text-navy-light/80 line-through',
            )}
          >
            <Icon size={size === 'sm' ? 10 : 12} />
            {label}
          </span>
        )
      })}
    </div>
  )
}

export default function AnalisisPage() {
  const { studyTypes: STUDY_TYPES } = useStudies('plans')
  const [selectedStudyId, setSelectedStudyId] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // Celda expandida para el drill-down: zona + categoría.
  const [expanded, setExpanded] = useState<{ zone: string; cat: 'graduating' | 'eligible' } | null>(null)
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})

  const study = selectedStudyId ? (STUDY_TYPES.find(s => s.id === selectedStudyId) ?? null) : null

  // Contexto de bloque (cliente: misma utilidad que usa el server).
  const now = new Date()
  const currentBlock = getCurrentBlock(now)
  const nextBlock = getNextBlock(now)

  // El reset de loading/expanded ocurre en el handler del select (no acá:
  // la regla react-hooks/set-state-in-effect prohíbe setState síncrono en effects).
  function selectStudy(id: string) {
    setSelectedStudyId(id)
    setAnalysis(null)
    setExpanded(null)
    setLoadError(false)
    setLoading(Boolean(id))
  }

  function retry() {
    setLoadError(false)
    setLoading(true)
    setReloadKey(k => k + 1)
  }

  useEffect(() => {
    if (!study) return
    let alive = true
    fetch(`/api/studies/analysis?study_code=${encodeURIComponent(study.code)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: Analysis) => {
        if (!alive) return
        setAnalysis(d)
        setLoading(false)
      })
      .catch(() => { if (alive) { setAnalysis(null); setLoadError(true); setLoading(false) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study?.code, reloadKey])

  // Nombres para el drill-down: se cargan al expandir una celda (cache local).
  function toggleExpand(zone: string, cat: 'graduating' | 'eligible', ids: string[]) {
    if (expanded?.zone === zone && expanded.cat === cat) { setExpanded(null); return }
    setExpanded({ zone, cat })
    const missing = ids.filter(id => !memberNames[id])
    if (missing.length === 0) return
    fetch('/api/members/by-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: missing }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { members?: Array<{ id: string; first_name: string; last_name: string }> } | null) => {
        if (!d?.members) return
        setMemberNames(prev => {
          const next = { ...prev }
          for (const m of d.members!) next[m.id] = `${m.first_name} ${m.last_name}`
          return next
        })
      })
      .catch(() => {})
  }

  const tooltipA = analysis
    ? `Están cursando ${analysis.studyInfo.prerequisite ?? 'el prerequisito'} y les faltan ≤ 5 semanas o completaron ≥ 50%`
    : ''
  const tooltipB = analysis
    ? `Completaron ${analysis.studyInfo.prerequisite ?? 'el prerequisito'} y cumplen todos los requisitos`
    : ''

  function MemberList({ ids }: { ids: string[] }) {
    return (
      <ul className="flex flex-wrap gap-2 py-1">
        {ids.map(id => (
          <li key={id}>
            <Link
              href={`/miembros/${id}`}
              className="inline-flex items-center gap-1 rounded-full bg-surface-low px-2.5 py-1 text-[13px] text-navy font-body hover:bg-navy/10 transition-colors"
            >
              {memberNames[id] ?? 'Cargando…'}
              <ExternalLink size={10} className="text-navy-light/80" />
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Análisis de bloque
        </h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          Estimación de demanda para etapas Inicial e Intermedia
        </p>
      </div>

      {/* Banner de contexto de bloque */}
      <div className="rounded-2xl bg-surface-card shadow-card px-5 py-4 flex items-center gap-3 flex-wrap">
        <span className="rounded-full bg-navy px-3 py-1 text-[13px] font-medium text-white font-body">
          Hoy: {currentBlock.label}
        </span>
        <span className="rounded-full bg-coral px-3 py-1 text-[13px] font-medium text-white font-body">
          Analizando para {nextBlock.label}
        </span>
        <span className="text-[13px] text-navy-light/80 font-body">
          Matrícula abre el {formatDateLong(nextBlock.enrollmentOpens)} · el bloque inicia el {formatDateLong(nextBlock.startsAt)}
        </span>
      </div>

      {/* Selector de estudio (solo Inicial e Intermedia; Niveles no aplican) */}
      <div className="rounded-2xl p-5 bg-surface-card shadow-card space-y-3">
        <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
          Seleccionar estudio a analizar
        </p>
        {/* DIS2/DIS3 no se analizan por separado: son continuos a Discípulos 1
            (la MISMA cohorte sigue en el mismo grupo), así que la demanda real
            es la de DIS1 (decisión 2026-08-21). */}
        <select
          className={cn(inputCls, 'max-w-md w-full')}
          value={selectedStudyId}
          onChange={e => selectStudy(e.target.value)}
          aria-label="Estudio a analizar"
        >
          <option value="">Seleccionar estudio...</option>
          <optgroup label="Etapa Inicial (requiere: asistencia)">
            {STUDY_TYPES.filter(s => s.stage === 'inicial' && !s.is_archived && s.is_curricular !== false).map(s => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}{s.prerequisite ? ` (prereq: ${s.prerequisite})` : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Etapa Intermedia (requiere: donante + asistencia + servidor)">
            {STUDY_TYPES.filter(s => s.stage === 'intermedia' && !s.is_archived && s.is_curricular !== false && !['DIS2', 'DIS3'].includes(s.code)).map(s => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}{s.prerequisite ? ` (prereq: ${s.prerequisite})` : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Etapa Avanzada (compromisos de intermedia + invitación)">
            {STUDY_TYPES.filter(s => s.stage === 'avanzada' && !s.is_archived && s.is_curricular !== false && !['DIS2', 'DIS3'].includes(s.code)).map(s => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}{s.prerequisite ? ` (prereq: ${s.prerequisite})` : ''}
              </option>
            ))}
          </optgroup>
        </select>

        {analysis && !loading && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] text-navy-light/80 font-body">
              {analysis.studyInfo.weeks > 0 ? `${analysis.studyInfo.weeks} semanas · ` : ''}
              prereq: <strong className="text-navy">{analysis.studyInfo.prerequisite ?? '—'}</strong> · compromisos:
            </span>
            <RequirementChips requirements={analysis.studyInfo.requirements} />
          </div>
        )}
      </div>

      {selectedStudyId && loading && (
        <div className="flex items-center justify-center gap-3 py-12">
          <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
          <span className="text-sm text-navy-light/80 font-body">Cargando…</span>
        </div>
      )}

      {selectedStudyId && !loading && loadError && (
        <ErrorState
          title="No se pudo cargar el análisis de demanda"
          message="Revisá tu conexión o permisos e intentá de nuevo."
          onRetry={retry}
        />
      )}

      {study && analysis && !loading && (
        <>
          {/* Cards de resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Demanda total estimada', value: analysis.totalDemand, color: 'text-navy' },
              { label: 'Por graduarse de prereq.', value: analysis.totalGraduating, color: 'text-coral' },
              { label: 'Elegibles sin inscribir', value: analysis.totalEligible, color: 'text-teal-deep' },
              { label: 'Grupos sugeridos', value: analysis.suggestedGroups, color: 'text-navy' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-card">
                <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                  {label}
                </p>
                <p className={`mt-2 text-3xl font-bold font-display ${color}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Desglose por zona */}
          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-card">
            <div className="px-5 py-4 border-b flex items-center gap-2 border-outline">
              <h2 className="text-sm font-semibold text-navy font-display">
                Desglose por zona
              </h2>
              <StudyTypeBadge code={study.code} size="sm" />
              <span className="text-[13px] text-navy-light/80 font-body ml-auto">
                Clic en un número para ver los miembros
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Zona</th>
                    <th
                      title={tooltipA}
                      className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display cursor-help underline decoration-dotted decoration-navy-light/50 underline-offset-2"
                    >
                      Por graduarse (A)
                    </th>
                    <th
                      title={tooltipB}
                      className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display cursor-help underline decoration-dotted decoration-navy-light/50 underline-offset-2"
                    >
                      Elegibles (B)
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Total demanda</th>
                    <th className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Grupos sugeridos</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-navy-light/80 font-body">
                        Sin demanda detectada para este estudio.
                      </td>
                    </tr>
                  )}
                  {analysis.rows.map(row => {
                    const isExpA = expanded?.zone === row.zone && expanded.cat === 'graduating'
                    const isExpB = expanded?.zone === row.zone && expanded.cat === 'eligible'
                    return (
                      <Fragment key={row.zone}>
                        <tr className="hover:bg-surface-low transition-colors border-b border-outline">
                          <td className="px-4 py-3 text-sm text-navy font-medium font-body">
                            {sedeLabel(row.zone)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleExpand(row.zone, 'graduating', row.graduating_members)}
                              disabled={row.graduating === 0}
                              className={cn(
                                'inline-flex items-center gap-1 text-sm font-body rounded-lg px-2 py-0.5 transition-colors',
                                row.graduating > 0 ? 'text-coral hover:bg-coral/10' : 'text-navy-light/80 cursor-default',
                              )}
                            >
                              {row.graduating}
                              {row.graduating > 0 && (isExpA ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleExpand(row.zone, 'eligible', row.eligible_members)}
                              disabled={row.eligible === 0}
                              className={cn(
                                'inline-flex items-center gap-1 text-sm font-body rounded-lg px-2 py-0.5 transition-colors',
                                row.eligible > 0 ? 'text-teal-deep hover:bg-teal/15' : 'text-navy-light/80 cursor-default',
                              )}
                            >
                              {row.eligible}
                              {row.eligible > 0 && (isExpB ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-navy font-body">
                            {row.graduating + row.eligible}
                          </td>
                          <td className="px-4 py-3 text-sm text-navy-light/80 font-body">
                            {suggestedGroups(row.graduating + row.eligible)}
                          </td>
                        </tr>
                        {(isExpA || isExpB) && (
                          <tr className="border-b border-outline bg-surface-low/60">
                            <td colSpan={5} className="px-4 py-2">
                              <p className="text-[13px] text-navy-light/80 font-body mb-1">
                                {isExpA ? `Por graduarse de ${analysis.studyInfo.prerequisite}` : 'Elegibles'} en {sedeLabel(row.zone)}:
                              </p>
                              <MemberList ids={isExpA ? row.graduating_members : row.eligible_members} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {analysis.rows.length > 0 && (
                    <tr className="bg-surface-low">
                      <td className="px-4 py-3 text-sm font-bold text-navy font-display">Total</td>
                      <td className="px-4 py-3 text-sm font-bold text-coral font-body">{analysis.totalGraduating}</td>
                      <td className="px-4 py-3 text-sm font-bold text-teal-deep font-body">{analysis.totalEligible}</td>
                      <td className="px-4 py-3 text-sm font-bold text-navy font-body">{analysis.totalDemand}</td>
                      <td className="px-4 py-3 text-sm font-bold text-navy font-body">{analysis.suggestedGroups}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedStudyId && (
        <div className="rounded-2xl p-10 text-center bg-surface-card shadow-card">
          <p className="text-sm text-navy-light/80 font-body">
            Seleccioná un estudio para ver el análisis de demanda.
          </p>
        </div>
      )}
    </div>
  )
}

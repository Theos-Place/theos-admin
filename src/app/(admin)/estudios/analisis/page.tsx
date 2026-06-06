'use client'

import { useState, useEffect } from 'react'
import { useStudies } from '@/hooks/useStudies'
import { sedeLabel } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { cn } from '@/lib/utils'
import { Send, CheckCircle } from 'lucide-react'

const INITIAL_DATE = '2026-05-16'

type DemandRow = { zone: string; graduating: number; eligible: number }
type Analysis = {
  rows: DemandRow[]
  totalGraduating: number
  totalEligible: number
  totalDemand: number
  suggestedGroups: number
}

export default function AnalisisPage() {
  const { studyTypes: STUDY_TYPES } = useStudies()
  const [selectedStudyId, setSelectedStudyId] = useState('')
  const [groupInputs, setGroupInputs] = useState<Record<string, number>>({})
  const [totalInput, setTotalInput] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)

  const study = selectedStudyId ? (STUDY_TYPES.find(s => s.id === selectedStudyId) ?? null) : null

  // Demanda por zona desde el server (agregado sobre study_enrollments).
  useEffect(() => {
    if (!study) { setAnalysis(null); return }
    let alive = true
    setLoading(true)
    fetch(`/api/studies/analysis?study_code=${encodeURIComponent(study.code)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { rows: DemandRow[]; totalGraduating: number; totalEligible: number } | null) => {
        if (!alive) return
        if (!d) { setAnalysis(null); setLoading(false); return }
        const totalDemand = d.totalGraduating + d.totalEligible
        const suggestedGroups = Math.ceil(totalDemand / 12)
        setAnalysis({ ...d, totalDemand, suggestedGroups })
        const inputs: Record<string, number> = {}
        d.rows.forEach(r => { inputs[r.zone] = Math.ceil((r.graduating + r.eligible) / 12) })
        setGroupInputs(inputs)
        setTotalInput(suggestedGroups)
        setSubmitted(false)
        setLoading(false)
      })
      .catch(() => { if (alive) { setAnalysis(null); setLoading(false) } })
    return () => { alive = false }
  }, [study])

  function handleSubmit() {
    setSubmitted(true)
  }

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          Análisis de bloque
        </h1>
        <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          Estimación de demanda para etapas Inicial e Intermedia
        </p>
      </div>

      {/* Study selector */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p
          className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Seleccionar estudio a analizar
        </p>
        <select
          className={cn(inputCls, 'max-w-md')}
          style={{ fontFamily: 'var(--font-body)' }}
          value={selectedStudyId}
          onChange={e => setSelectedStudyId(e.target.value)}
        >
          <option value="">Seleccionar estudio...</option>
          <optgroup label="Etapa Inicial">
            {STUDY_TYPES.filter(s => s.stage === 'inicial').map(s => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </optgroup>
          <optgroup label="Etapa Intermedia">
            {STUDY_TYPES.filter(s => s.stage === 'intermedia').map(s => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {selectedStudyId && loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
        </div>
      )}

      {study && analysis && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Demanda total estimada', value: analysis.totalDemand, color: 'text-navy' },
              { label: 'Por graduarse de prereq.', value: analysis.totalGraduating, color: 'text-coral' },
              { label: 'Elegibles sin inscribir', value: analysis.totalEligible, color: 'text-teal-deep' },
              { label: 'Grupos sugeridos', value: analysis.suggestedGroups, color: 'text-navy' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                <p
                  className="text-[10px] tracking-widests uppercase text-navy-light/40"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {label}
                </p>
                <p className={`mt-2 text-3xl font-bold ${color}`} style={{ fontFamily: 'var(--font-display)' }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Zone breakdown table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--outline-variant)' }}>
              <h2 className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                Desglose por zona
              </h2>
              <StudyTypeBadge code={study.code} size="sm" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Zona', 'Por graduarse', 'Otros elegibles', 'Total demanda', 'Grupos sugeridos'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/50"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.rows.map(row => (
                    <tr
                      key={row.zone}
                      className="hover:bg-surface-low transition-colors"
                      style={{ borderBottom: '1px solid var(--outline-variant)' }}
                    >
                      <td className="px-4 py-3 text-sm text-navy font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                        {sedeLabel(row.zone)}
                      </td>
                      <td className="px-4 py-3 text-sm text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                        {row.graduating}
                      </td>
                      <td className="px-4 py-3 text-sm text-teal-deep" style={{ fontFamily: 'var(--font-body)' }}>
                        {row.eligible}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                        {row.graduating + row.eligible}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                        {Math.ceil((row.graduating + row.eligible) / 12)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-surface-low">
                    <td className="px-4 py-3 text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                      {analysis.totalGraduating}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-teal-deep" style={{ fontFamily: 'var(--font-body)' }}>
                      {analysis.totalEligible}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      {analysis.totalDemand}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      {analysis.suggestedGroups}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel de apertura */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <h2
              className="text-[10px] tracking-widests uppercase text-navy-light/40"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Panel de apertura
            </h2>

            {submitted ? (
              <div className="flex items-center gap-3 rounded-xl bg-teal-soft/20 px-4 py-3">
                <CheckCircle size={16} className="text-teal-deep" />
                <p className="text-sm text-teal-deep" style={{ fontFamily: 'var(--font-body)' }}>
                  Solicitudes enviadas al coordinador el {INITIAL_DATE}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-navy-light/60 shrink-0" style={{ fontFamily: 'var(--font-body)' }}>
                    ¿Cuántos grupos querés abrir?
                  </label>
                  <input
                    type="number"
                    min={1}
                    className={cn(inputCls, 'w-20')}
                    style={{ fontFamily: 'var(--font-body)' }}
                    value={totalInput ?? ''}
                    onChange={e => setTotalInput(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                    Distribución por zona
                  </p>
                  {analysis.rows.map(row => (
                    <div key={row.zone} className="flex items-center gap-3">
                      <span className="text-sm text-navy-light/60 w-36 shrink-0" style={{ fontFamily: 'var(--font-body)' }}>
                        {sedeLabel(row.zone)}
                      </span>
                      <input
                        type="number"
                        min={0}
                        className={cn(inputCls, 'w-16')}
                        style={{ fontFamily: 'var(--font-body)' }}
                        value={groupInputs[row.zone] ?? 0}
                        onChange={e => setGroupInputs(prev => ({ ...prev, [row.zone]: Number(e.target.value) }))}
                      />
                      <span className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                        grupos
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmit}
                  className="inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <Send size={14} /> Solicitar apertura
                </button>
              </>
            )}
          </div>
        </>
      )}

      {!selectedStudyId && (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
        >
          <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
            Seleccioná un estudio para ver el análisis de demanda.
          </p>
        </div>
      )}
    </div>
  )
}

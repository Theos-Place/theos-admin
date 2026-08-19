'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import type { StudyGroup, StudyType } from '@/types/study'
import { toDomainStudyGroup, toDomainStudyType } from '@/lib/studies/adapter'
import { sedeLabel } from '@/lib/sedes'
import { cn } from '@/lib/utils'
import { ChevronLeft, CheckCircle, Users } from 'lucide-react'
import { getInitials, toYmdLocal } from '@/lib/format'

export default function AsistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [group, setGroup] = useState<StudyGroup | null>(null)
  const [studyType, setStudyType] = useState<StudyType | null>(null)
  const [loading, setLoading] = useState(true)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')
  const todayYmd = toYmdLocal(new Date()) // hora local, no UTC (después de las 6 pm difieren)
  const [sessionDate, setSessionDate] = useState(todayYmd)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carga el grupo real y su plan de estudio.
  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/studies/groups/${id}`).then(r => (r.ok ? r.json() : null)),
      fetch('/api/studies/plans').then(r => (r.ok ? r.json() : [])),
    ]).then(([g, plans]) => {
      if (!alive) return
      const domainGroup = g ? toDomainStudyGroup(g) : null
      setGroup(domainGroup)
      if (domainGroup && Array.isArray(plans)) {
        const plan = plans.find((p: { code: string }) => p.code === domainGroup.study_type_id)
        setStudyType(plan ? toDomainStudyType(plan) : null)
      }
      const init: Record<string, boolean> = {}
      domainGroup?.participants.filter(p => p.status === 'enrolled').forEach(p => { init[p.member_id] = false })
      setAttendance(init)
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  const enrolled = group?.participants.filter(p => p.status === 'enrolled') ?? []

  if (loading) {
    return <div className="flex items-center justify-center min-h-60"><p className="text-sm text-navy-light/80 font-body">Cargando…</p></div>
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/grupos" className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy">
          <ChevronLeft size={16} /> Grupos
        </Link>
        <p className="text-navy-light/80 font-body">Grupo no encontrado.</p>
      </div>
    )
  }

  const presentCount = Object.values(attendance).filter(Boolean).length
  const sessionNum = group.current_week + 1

  function markAll() {
    const all: Record<string, boolean> = {}
    enrolled.forEach(p => { all[p.member_id] = true })
    setAttendance(all)
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/studies/groups/${id}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_date: sessionDate,
          notes: notes.trim() || null,
          attendance: enrolled.map(p => ({ member_id: p.member_id, present: attendance[p.member_id] ?? false })),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSaved(true)
    } catch (err) {
      console.error('No se pudo guardar la asistencia:', err)
      setError('No se pudo guardar la asistencia. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-3">
          <CheckCircle size={48} className="text-teal-deep mx-auto" />
          <p className="text-xl font-bold text-navy font-display">
            Asistencia guardada
          </p>
          <p className="text-sm text-navy-light/80 font-body">
            {presentCount} de {enrolled.length} participantes presentes.
          </p>
          <Link
            href={`/estudios/grupos/${id}`}
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors mt-2"
          >
            Volver al grupo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/estudios/grupos/${id}`}
        className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Volver al grupo
      </Link>

      {/* Header */}
      <div>
        <h1
          className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
        >
          Pasar lista
        </h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          {group.study_type_id} — {sedeLabel(group.zone)}
        </p>
        {/* Fecha editable (default hoy, sin futuro): permite registrar una
            sesión pasada que quedó sin pasar lista ese día. */}
        <label className="mt-1 flex items-center gap-2 text-sm text-navy-light/80 font-body">
          Fecha de la sesión
          <input
            type="date"
            value={sessionDate}
            max={todayYmd}
            onChange={e => setSessionDate(e.target.value)}
            className="rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          />
        </label>
      </div>

      {/* Herramienta de una acción: lista a la izquierda, resumen + notas a la derecha. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Participant list */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="divide-y border-[var(--outline-variant)]">
            {enrolled.map(p => {
              const present = attendance[p.member_id] ?? false
              return (
                <div
                  key={p.member_id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-low transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-navy/10 flex items-center justify-center text-[11px] font-bold text-navy shrink-0">
                    {getInitials(p.member_name)}
                  </div>
                  <span
                    className="flex-1 text-sm text-navy font-body"
                  >
                    {p.member_name}
                  </span>
                  <button
                    onClick={() => setAttendance(prev => ({ ...prev, [p.member_id]: !prev[p.member_id] }))}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-[13px] font-medium transition-all',
                      present
                        ? 'bg-teal-deep text-white'
                        : 'bg-surface-low text-navy-light/80 hover:bg-surface-card',
                      'font-display',
                    )}
                  >
                    {present ? 'Presente' : 'Ausente'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel: sesión, contador, notas y guardado */}
        <div className="space-y-5 lg:sticky lg:top-6">
          {/* Session info & counter */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p
                  className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
                >
                  Sesión {sessionNum} de {studyType?.weeks ?? '?'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p
                    className="text-2xl font-bold text-coral font-display"
                  >
                    {presentCount} / {enrolled.length}
                  </p>
                  <p className="text-[13px] text-navy-light/80 font-body">presentes</p>
                </div>
                <button
                  onClick={markAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
                >
                  <Users size={14} /> Marcar todos presentes
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label
              className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display"
            >
              Notas de la sesión
            </label>
            <textarea
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
              rows={3}
              placeholder="Temas tratados, observaciones del grupo, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-[13px] text-coral font-body">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
          >
            {saving ? 'Guardando…' : 'Guardar asistencia'}
          </button>
        </div>
      </div>
    </div>
  )
}


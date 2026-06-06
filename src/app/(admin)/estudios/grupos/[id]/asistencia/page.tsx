'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import type { StudyGroup, StudyType } from '@/types/study'
import { toDomainStudyGroup, toDomainStudyType } from '@/lib/studies/adapter'
import { sedeLabel } from '@/lib/sedes'
import { cn } from '@/lib/utils'
import { ChevronLeft, CheckCircle, Users } from 'lucide-react'

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

export default function AsistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [group, setGroup] = useState<StudyGroup | null>(null)
  const [studyType, setStudyType] = useState<StudyType | null>(null)
  const [loading, setLoading] = useState(true)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')
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
    return <div className="flex items-center justify-center min-h-60"><p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Cargando…</p></div>
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/grupos" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Grupos
        </Link>
        <p className="text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>Grupo no encontrado.</p>
      </div>
    )
  }

  const presentCount = Object.values(attendance).filter(Boolean).length
  const today = new Date().toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
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
          session_date: new Date().toISOString().slice(0, 10),
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
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Asistencia guardada
          </p>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
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
    <div className="max-w-xl space-y-5">
      <Link
        href={`/estudios/grupos/${id}`}
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronLeft size={16} /> Volver al grupo
      </Link>

      {/* Header */}
      <div>
        <h1
          className="text-2xl text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          Pasar lista
        </h1>
        <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          {group.study_type_id} — {sedeLabel(group.zone)}
        </p>
        <p className="text-sm text-navy-light/50 capitalize" style={{ fontFamily: 'var(--font-body)' }}>
          {today}
        </p>
      </div>

      {/* Session info & counter */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p
              className="text-[10px] tracking-widest uppercase text-navy-light/40"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Sesión {sessionNum} de {studyType?.weeks ?? '?'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p
                className="text-2xl font-bold text-coral"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {presentCount} / {enrolled.length}
              </p>
              <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>presentes</p>
            </div>
            <button
              onClick={markAll}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Users size={14} /> Marcar todos presentes
            </button>
          </div>
        </div>
      </div>

      {/* Participant list */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="divide-y" style={{ borderColor: 'var(--outline-variant)' }}>
          {enrolled.map(p => {
            const present = attendance[p.member_id] ?? false
            return (
              <div
                key={p.member_id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-low transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy shrink-0">
                  {getInitials(p.member_name)}
                </div>
                <span
                  className="flex-1 text-sm text-navy"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {p.member_name}
                </span>
                <button
                  onClick={() => setAttendance(prev => ({ ...prev, [p.member_id]: !prev[p.member_id] }))}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-[12px] font-medium transition-all',
                    present
                      ? 'bg-teal-deep text-white'
                      : 'bg-surface-low text-navy-light/50 hover:bg-surface-card'
                  )}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {present ? 'Presente' : 'Ausente'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label
          className="text-[11px] tracking-widest uppercase text-navy-light/40"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Notas de la sesión
        </label>
        <textarea
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none"
          style={{ fontFamily: 'var(--font-body)' }}
          rows={3}
          placeholder="Temas tratados, observaciones del grupo, etc."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-50"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {saving ? 'Guardando…' : 'Guardar asistencia'}
      </button>
    </div>
  )
}


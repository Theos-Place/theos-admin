'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MOCK_GROUPS, getStudyType } from '@/data/mock-studies'
import { cn } from '@/lib/utils'
import { ChevronLeft, CheckCircle, Users } from 'lucide-react'

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

export default function AsistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const group = MOCK_GROUPS.find(g => g.id === id)
  const studyType = group ? getStudyType(group.study_type_id) : null

  const enrolled = group?.participants.filter(p => p.status === 'enrolled') ?? []
  const [attendance, setAttendance] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    enrolled.forEach(p => { init[p.member_id] = false })
    return init
  })
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

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

      <button
        onClick={() => setSaved(true)}
        className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        Guardar asistencia
      </button>
    </div>
  )
}

function sedeLabel(id: string): string {
  const SEDES: Record<string, string> = {
    meridiano: 'Meridiano', antares: 'Antares', liberia: 'Liberia',
    guapiles: 'Guápiles', cartago: 'Cartago', 'perez-zeledon': 'Pérez Zeledón',
    potrero: 'Potrero', alajuela: 'Alajuela', madrid: 'Madrid', pedregal: 'Pedregal',
  }
  return SEDES[id] ?? id
}

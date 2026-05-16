'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MOCK_LEADERS, MOCK_GROUPS, STUDY_TYPES } from '@/data/mock-studies'
import { sedeLabel } from '@/data/mock-sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { CommitmentIcons } from '@/components/studies/CommitmentIcons'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { cn } from '@/lib/utils'
import { ChevronLeft, AlertTriangle, Plus, Star } from 'lucide-react'

const AVAILABILITY_CONFIG = {
  available: { label: 'Disponible', className: 'bg-teal-soft/30 text-teal-deep' },
  assigned:  { label: 'Asignado',   className: 'bg-navy/10 text-navy' },
  resting:   { label: 'Descansando', className: 'bg-amber-100 text-amber-700' },
}

const AVATAR_COLORS = [
  'bg-coral/20 text-coral',
  'bg-teal-soft/30 text-teal-deep',
  'bg-navy/10 text-navy',
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={14}
          className={i <= score ? 'text-amber-400 fill-amber-400' : 'text-navy-light/20'}
        />
      ))}
    </div>
  )
}

export default function DirigentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const leader = MOCK_LEADERS.find(l => l.id === id)
  const [activeTab, setActiveTab] = useState('resumen')
  const [addStudy, setAddStudy] = useState(false)
  const [newStudy, setNewStudy] = useState('')

  if (!leader) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/dirigentes" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Dirigentes
        </Link>
        <p className="text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>Dirigente no encontrado.</p>
      </div>
    )
  }

  const avail = AVAILABILITY_CONFIG[leader.availability_status]
  const initials = getInitials(leader.member_name)
  const avatarColor = getAvatarColor(leader.member_name)
  const leaderGroups = MOCK_GROUPS.filter(g => g.leader_id === id)
  const hasCritical = leader.evaluations.some(e => e.score <= 2)
  const tabs = ['resumen', 'evaluaciones', 'cualificaciones']
  const tabLabels: Record<string, string> = { resumen: 'Resumen', evaluaciones: 'Evaluaciones', cualificaciones: 'Cualificaciones' }

  const avgRating = leader.evaluations.length > 0
    ? leader.evaluations.reduce((sum, e) => sum + e.score, 0) / leader.evaluations.length
    : 0
  const lastFive = leader.evaluations.slice(-5)
  const maxBarHeight = 80

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href="/estudios/dirigentes"
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronLeft size={16} /> Dirigentes
      </Link>

      {/* Header card */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className={cn('h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0', avatarColor)}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="text-xl text-navy"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
              >
                {leader.member_name}
              </h1>
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', avail.className)}>
                {avail.label}
              </span>
              {hasCritical && (
                <span className="inline-flex items-center gap-1 rounded-md bg-coral/10 px-2 py-0.5 text-[11px] font-medium text-coral">
                  <AlertTriangle size={11} /> Evaluación crítica
                </span>
              )}
            </div>
            <p className="text-sm text-navy-light/60 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              {sedeLabel(leader.zone_preference)}
            </p>
            <div className="mt-3">
              <CommitmentIcons
                donor={leader.commitments.is_donor}
                server={leader.commitments.is_server}
                charlas={leader.commitments.attends_charlas}
                size={16}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Editar
            </button>
            <button
              className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Cambiar estado
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm transition-all border-b-2 -mb-px',
              activeTab === t
                ? 'border-coral text-coral font-medium'
                : 'border-transparent text-navy-light/60 hover:text-navy'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {activeTab === 'resumen' && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Grupos liderados', value: leader.stats.groups_led },
              { label: 'Calificación prom.', value: `${leader.stats.avg_rating.toFixed(1)} / 5` },
              { label: 'Participantes activos', value: leader.stats.current_participants },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                <p
                  className="text-[10px] tracking-widest uppercase text-navy-light/40"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {label}
                </p>
                <p
                  className="text-2xl font-bold text-navy mt-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Groups table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <h2 className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                Grupos liderados ({leaderGroups.length})
              </h2>
            </div>
            {leaderGroups.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>Sin grupos registrados.</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Estudio', 'Zona', 'Participantes', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50" style={{ fontFamily: 'var(--font-display)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderGroups.map(g => (
                    <tr key={g.id} className="hover:bg-surface-low transition-colors" style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                      <td className="px-4 py-3"><StudyTypeBadge code={g.study_type_id} size="sm" /></td>
                      <td className="px-4 py-3 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{sedeLabel(g.zone)}</td>
                      <td className="px-4 py-3 text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                        {g.participants.filter(p => p.status !== 'withdrawn').length}/{g.max_capacity}
                      </td>
                      <td className="px-4 py-3"><GroupStatusBadge status={g.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Evaluaciones */}
      {activeTab === 'evaluaciones' && (
        <div className="space-y-5">
          {/* Big rating */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-5xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                  {avgRating.toFixed(1)}
                </p>
                <p className="text-sm text-navy-light/50 mt-1" style={{ fontFamily: 'var(--font-body)' }}>de 5</p>
                <div className="mt-2 flex justify-center">
                  <StarRating score={Math.round(avgRating)} />
                </div>
              </div>

              {/* Mini bar chart */}
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Últimas {lastFive.length} evaluaciones
                </p>
                <div className="flex items-end gap-2 h-20">
                  {lastFive.map((ev) => (
                    <div key={ev.id} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className="w-full rounded-t bg-navy transition-all"
                        style={{ height: `${(ev.score / 5) * maxBarHeight}px` }}
                      />
                      <span className="text-[10px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>{ev.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Individual evaluations */}
          <div className="space-y-3">
            {leader.evaluations.map(ev => (
              <div
                key={ev.id}
                className="rounded-2xl p-4"
                style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-bold',
                        ev.score >= 4 ? 'bg-teal-soft/30 text-teal-deep' :
                        ev.score === 3 ? 'bg-navy/10 text-navy' : 'bg-coral/10 text-coral'
                      )}>
                        {ev.score} / 5
                      </span>
                      {ev.score <= 2 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-coral">
                          <AlertTriangle size={11} /> Evaluación crítica
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-navy-light/50 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
                      {ev.group_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <StarRating score={ev.score} />
                    <p className="text-[11px] text-navy-light/40 mt-1" style={{ fontFamily: 'var(--font-body)' }}>{ev.date}</p>
                  </div>
                </div>
                <p className="text-sm text-navy-light/70 italic" style={{ fontFamily: 'var(--font-body)' }}>
                  &ldquo;{ev.comments}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Cualificaciones */}
      {activeTab === 'cualificaciones' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div>
              <p
                className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Puede impartir
              </p>
              <div className="flex flex-wrap gap-1.5">
                {leader.qualified_studies.map(code => (
                  <StudyTypeBadge key={code} code={code} size="md" />
                ))}
              </div>

              {addStudy ? (
                <div className="flex items-center gap-2 mt-3">
                  <select
                    className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                    style={{ fontFamily: 'var(--font-body)' }}
                    value={newStudy}
                    onChange={e => setNewStudy(e.target.value)}
                  >
                    <option value="">Seleccionar estudio...</option>
                    {STUDY_TYPES
                      .filter(s => !leader.qualified_studies.includes(s.code))
                      .map(s => (
                        <option key={s.id} value={s.code}>{s.code} — {s.name}</option>
                      ))}
                  </select>
                  <button
                    onClick={() => { setAddStudy(false); setNewStudy('') }}
                    className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setAddStudy(false)}
                    className="text-sm text-navy-light/50 hover:text-navy-light transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddStudy(true)}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-coral hover:text-coral-deep transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <Plus size={14} /> Agregar estudio
                </button>
              )}
            </div>

            <div className="border-t pt-4" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Zona de preferencia
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                  {sedeLabel(leader.zone_preference)}
                </span>
                <button className="text-[11px] text-coral hover:text-coral-deep transition-colors">
                  Cambiar
                </button>
              </div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Estado de disponibilidad
              </p>
              <div className="flex gap-2">
                {(['available', 'assigned', 'resting'] as const).map(s => (
                  <span
                    key={s}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11px] font-medium',
                      leader.availability_status === s ? AVAILABILITY_CONFIG[s].className : 'bg-surface-low text-navy-light/40'
                    )}
                  >
                    {AVAILABILITY_CONFIG[s].label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

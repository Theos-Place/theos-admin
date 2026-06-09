'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useStudies } from '@/hooks/useStudies'
import { sedeLabel, useSedes } from '@/lib/sedes'
import { STUDY_CATALOG } from '@/data/study-catalog'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { CommitmentIcons } from '@/components/studies/CommitmentIcons'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { ChevronLeft, AlertTriangle, Plus, Star, Pencil, X, ExternalLink } from 'lucide-react'

const AVAILABILITY_CONFIG = {
  available: { label: 'Disponible',  className: 'bg-teal-soft/30 text-teal-deep',  description: 'Puede recibir nuevos grupos.' },
  assigned:  { label: 'Asignado',    className: 'bg-navy/10 text-navy',             description: 'Dirigiendo un grupo actualmente.' },
  resting:   { label: 'En descanso', className: 'bg-amber-100 text-amber-700',      description: 'Temporalmente no disponible.' },
  inactive:  { label: 'Inactivo',    className: 'bg-navy/5 text-navy-light/40',     description: 'Ya no es dirigente activo.' },
}

type AvailabilityStatus = keyof typeof AVAILABILITY_CONFIG

const STAGE_LABELS: Record<string, string> = {
  niveles: 'Niveles', inicial: 'Etapa Inicial', intermedia: 'Etapa Intermedia', 'campaña': 'Campaña',
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

// TODO: persistir vía PUT /api/studies/leaders/[id] (write path). Por ahora no-op.
function updateLeaderInMock(_id: string, _data: Record<string, unknown>) {}

export default function DirigentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { leaders, groups } = useStudies()
  const { activeSedes: ACTIVE_SEDES } = useSedes()
  const leader = leaders.find(l => l.id === id)

  const [activeTab, setActiveTab] = useState('resumen')
  const [editOpen, setEditOpen] = useState(false)
  const [qualifications, setQualifications] = useState<string[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [status, setStatus] = useState<AvailabilityStatus>('available')
  const [studyToAdd, setStudyToAdd] = useState('')

  // Sincroniza el estado editable cuando carga el dirigente.
  useEffect(() => {
    if (!leader) return
    setQualifications(leader.qualified_studies ?? [])
    setZones(leader.zone_preference ?? [])
    setStatus((leader.availability_status as AvailabilityStatus) ?? 'available')
  }, [leader])

  if (!leader) {
    return (
      <div className="page">
        <div className="ph"><div className="ptitle">Dirigentes</div></div>
        <div className="card p-[22px]">
          <p className="text-[13px] text-[var(--fg-muted)] text-center py-8 font-body">
            Dirigente no encontrado.
          </p>
        </div>
      </div>
    )
  }

  const availableToAdd = STUDY_CATALOG.filter(s => !qualifications.includes(s.code))

  function toggleZone(zoneId: string) {
    setZones(prev => prev.includes(zoneId) ? prev.filter(z => z !== zoneId) : [...prev, zoneId])
  }

  function handleSave() {
    updateLeaderInMock(id, { qualified_studies: qualifications, zone_preference: zones, availability_status: status })
    setEditOpen(false)
  }

  const avail = AVAILABILITY_CONFIG[status] ?? AVAILABILITY_CONFIG.inactive
  const initials = getInitials(leader.member_name)
  const avatarColor = getAvatarColor(leader.member_name)
  const leaderGroups = groups.filter(g => g.leader_id === leader?.member_id)
  const hasCritical = leader.evaluations.some(e => e.score <= 2)
  const tabs = ['resumen', 'evaluaciones', 'cualificaciones']
  const tabLabels: Record<string, string> = { resumen: 'Resumen', evaluaciones: 'Evaluaciones', cualificaciones: 'Cualificaciones' }

  const avgRating = leader.evaluations.length > 0
    ? leader.evaluations.reduce((sum, e) => sum + e.score, 0) / leader.evaluations.length
    : 0
  const lastFive = leader.evaluations.slice(-5)
  const maxBarHeight = 80

  const studiesByStage = ['niveles', 'inicial', 'intermedia', 'campaña'].map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    studies: availableToAdd.filter(c => c.stage === stage),
  })).filter(g => g.studies.length > 0)

  const statusKeys = Object.keys(AVAILABILITY_CONFIG) as AvailabilityStatus[]

  return (
    <div className="page">

      {/* Modal unificado de edición */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div
            className="relative rounded-2xl p-6 max-w-lg w-full mx-4 space-y-6 overflow-y-auto max-h-[90vh] bg-surface-card shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-navy font-display">
                Editar dirigente — {leader.member_name}
              </h2>
              <button onClick={() => setEditOpen(false)} className="text-navy-light/40 hover:text-navy transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* ── Sección 1: Estudios que puede impartir ── */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-widests uppercase text-navy-light/40 font-display">
                Estudios que puede impartir
              </p>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {qualifications.length === 0 && (
                  <span className="text-[12px] text-navy-light/40 font-body">
                    Sin estudios asignados
                  </span>
                )}
                {qualifications.map(code => {
                  const study = STUDY_CATALOG.find(s => s.code === code)
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 rounded-full bg-navy/8 px-3 py-1 text-[12px] font-medium text-navy font-display"
                    >
                      {study ? `${study.code} — ${study.name}` : code}
                      <button
                        onClick={() => setQualifications(q => q.filter(x => x !== code))}
                        className="text-navy-light/40 hover:text-coral transition-colors"
                        title="Quitar"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  value={studyToAdd}
                  onChange={e => setStudyToAdd(e.target.value)}
                >
                  <option value="">Agregar estudio...</option>
                  {studiesByStage.map(group => (
                    <optgroup key={group.stage} label={group.label}>
                      {group.studies.map(s => (
                        <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  disabled={!studyToAdd}
                  onClick={() => {
                    if (!studyToAdd) return
                    setQualifications(q => [...q, studyToAdd])
                    setStudyToAdd('')
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-coral px-3 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
                >
                  <Plus size={13} /> Agregar
                </button>
              </div>
            </div>

            <div className="h-px bg-[var(--outline-variant)]" />

            {/* ── Sección 2: Zonas de preferencia ── */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-widests uppercase text-navy-light/40 font-display">
                Zonas de preferencia
              </p>
              <div className="flex flex-wrap gap-2">
                {ACTIVE_SEDES.map(sede => {
                  const selected = zones.includes(sede.id)
                  return (
                    <button
                      key={sede.id}
                      type="button"
                      onClick={() => toggleZone(sede.id)}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-[12px] font-medium border-2 transition-all duration-150',
                        selected
                          ? 'border-teal-deep bg-teal-soft/15 text-teal-deep'
                          : 'border-transparent text-navy-light/60 hover:bg-surface-low',
                        'font-display',
                      )}
                      style={{
                        borderColor: selected ? undefined : 'var(--outline-variant)',
                      }}
                    >
                      {selected ? '✓ ' : ''}{sede.name}
                    </button>
                  )
                })}
              </div>
              {zones.length === 0 && (
                <p className="text-[11px] text-coral font-body">
                  Seleccioná al menos una zona
                </p>
              )}
              {zones.length > 0 && (
                <p className="text-[11px] text-navy-light/50 font-body">
                  {zones.length} zona{zones.length !== 1 ? 's' : ''} seleccionada{zones.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="h-px bg-[var(--outline-variant)]" />

            {/* ── Sección 3: Estado de disponibilidad ── */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-widests uppercase text-navy-light/40 font-display">
                Estado de disponibilidad
              </p>
              <div className="space-y-2">
                {statusKeys.map(key => {
                  const cfg = AVAILABILITY_CONFIG[key]
                  return (
                    <label
                      key={key}
                      className={cn(
                        'flex items-start gap-3 rounded-xl px-3 py-3 cursor-pointer border-2 transition-all',
                        status === key
                          ? 'border-coral bg-coral/5'
                          : 'border-transparent hover:bg-surface-low'
                      )}
                      style={{ borderColor: status === key ? undefined : 'var(--outline-variant)' }}
                    >
                      <input
                        type="radio"
                        name="leader-status"
                        value={key}
                        checked={status === key}
                        onChange={() => setStatus(key)}
                        className="mt-0.5 accent-coral"
                      />
                      <div>
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', cfg.className)}>
                          {cfg.label}
                        </span>
                        <p className="text-[12px] text-navy-light/60 mt-1 font-body">
                          {cfg.description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={zones.length === 0}
                className="rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 font-body"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="ph">
        <button className="btn btn-ghost btn-sm mb-[10px]" onClick={() => router.back()}>
          ← Volver a dirigentes
        </button>
        <div className="ph-row">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0', avatarColor)}>
              {initials}
            </div>
            <div>
              <div className="ptitle">{leader.member_name}</div>
              <div className="psub">
                {zones.length > 0 ? zones.map(z => sedeLabel(z)).join(' · ') : 'Sin zona de preferencia'}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/miembros/${leader.member_id}`)}>
              <ExternalLink size={13} /> Ver perfil de miembro
            </button>
          </div>
          <div className="ph-actions">
            {hasCritical && (
              <span className="inline-flex items-center gap-1 rounded-md bg-coral/10 px-2 py-0.5 text-[11px] font-medium text-coral">
                <AlertTriangle size={11} /> Evaluación crítica
              </span>
            )}
            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', avail.className)}>
              {avail.label}
            </span>
            <CommitmentIcons
              donor={leader.commitments.is_donor}
              server={leader.commitments.is_server}
              charlas={leader.commitments.attends_charlas}
              size={16}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}>
              <Pencil size={13} /> Editar
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        {[
          { label: 'Grupos liderados',      value: leader.stats.groups_led },
          { label: 'Calificación prom.',    value: `${leader.stats.avg_rating.toFixed(1)} / 5` },
          { label: 'Participantes activos', value: leader.stats.current_participants },
        ].map(({ label, value }) => (
          <div key={label} className="card py-[18px] px-[22px]">
            <div className="st">{label}</div>
            <div className="text-[22px] font-extrabold text-navy-light font-display mt-2">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs card ── */}
      <div className="card w-full">

        {/* Tab bar */}
        <div className="flex border-b border-[rgba(22,20,64,0.09)] px-[22px] overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                'px-4 py-3 text-sm transition-all border-b-2 -mb-px',
                activeTab === t
                  ? 'border-coral text-coral font-medium'
                  : 'border-transparent text-navy-light/60 hover:text-navy',
                'font-body',
              )}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* Tab: Resumen */}
        {activeTab === 'resumen' && (
          <div>
            <div className="card-hd">
              <div className="card-title">Grupos liderados ({leaderGroups.length})</div>
            </div>
            {leaderGroups.length === 0 ? (
              <div className="py-10 px-[22px] text-center">
                <p className="text-[13px] text-[rgba(41,54,92,0.4)] font-body">Sin grupos registrados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(22,20,64,0.09)]">
                      {['Estudio', 'Zona', 'Participantes', 'Estado'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/50 font-display">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderGroups.map(g => (
                      <tr key={g.id} className="hover:bg-surface-low transition-colors border-b border-[rgba(22,20,64,0.06)]">
                        <td className="px-4 py-3"><StudyTypeBadge code={g.study_type_id} size="sm" /></td>
                        <td className="px-4 py-3 text-sm text-navy-light/70 font-body">{sedeLabel(g.zone)}</td>
                        <td className="px-4 py-3 text-sm text-navy font-body">
                          {g.participants.filter(p => p.status !== 'withdrawn').length}/{g.max_capacity}
                        </td>
                        <td className="px-4 py-3"><GroupStatusBadge status={g.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* Tab: Evaluaciones */}
      {activeTab === 'evaluaciones' && (
        <div className="py-5 px-[22px] flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-5xl font-bold text-navy font-display">
                  {avgRating.toFixed(1)}
                </p>
                <p className="text-sm text-navy-light/50 mt-1 font-body">de 5</p>
                <div className="mt-2 flex justify-center">
                  <StarRating score={Math.round(avgRating)} />
                </div>
              </div>
              <div className="flex-1">
                {/* Título de la sección */}
                <div className="st mb-4">
                  Evaluaciones por grupo
                </div>

                {/* Gráfico de barras */}
                <div className="flex items-end gap-3 h-[120px] pt-6 mb-5">
                  {leader.evaluations?.map((ev, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-[11px] font-bold text-navy-light">
                        {ev.score}
                      </span>
                      <div
                        className="w-full rounded-t-[6px] min-h-[8px]"
                        style={{
                          height: `${(ev.score / 5) * 80}px`,
                          background: ev.score <= 2 ? 'var(--brand-coral)' : 'var(--brand-teal)',
                        }}
                      />
                      <span className="text-[10px] text-[var(--fg-muted)] text-center max-w-[60px] overflow-hidden text-ellipsis whitespace-nowrap font-body">
                        {ev.group_name || `Grupo ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {leader.evaluations.map(ev => (
              <div
                key={ev.id}
                className="rounded-[14px] py-[14px] px-4 bg-surface-low"
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
                    <p className="text-[12px] text-navy-light/50 mt-1 font-body">{ev.group_name}</p>
                  </div>
                  <div className="text-right">
                    <StarRating score={ev.score} />
                    <p className="text-[11px] text-navy-light/40 mt-1 font-body">{ev.date}</p>
                  </div>
                </div>
                <p className="text-sm text-navy-light/70 italic font-body">
                  &ldquo;{ev.comments}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Cualificaciones */}
      {activeTab === 'cualificaciones' && (
        <div className="py-5 px-[22px] flex flex-col gap-5">

          <div>
            <div className="st mb-2">Puede impartir</div>
            <div className="flex flex-wrap gap-1.5">
              {qualifications.map(code => (
                <StudyTypeBadge key={code} code={code} size="md" />
              ))}
              {qualifications.length === 0 && (
                <p className="text-[13px] text-[rgba(41,54,92,0.4)] font-body">Sin estudios registrados.</p>
              )}
            </div>
          </div>

          <div className="border-t border-[rgba(22,20,64,0.09)] pt-4">
            <div className="st mb-1.5">Zonas de preferencia</div>
            <p className="text-[13px] text-navy-light font-body">
              {zones.length > 0 ? zones.map(z => sedeLabel(z)).join(' · ') : '—'}
            </p>
          </div>

          <div className="border-t border-[rgba(22,20,64,0.09)] pt-4">
            <div className="st mb-1.5">Estado de disponibilidad</div>
            <span className={cn('rounded-md px-2.5 py-1 text-[12px] font-medium', avail.className)}>
              {avail.label}
            </span>
          </div>

          <div className="border-t border-[rgba(22,20,64,0.09)] pt-4">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm text-coral hover:text-coral-deep transition-colors font-body"
            >
              <Pencil size={13} /> Editar cualificaciones
            </button>
          </div>

        </div>
      )}

      </div>{/* end .card tabs */}
    </div>
  )
}

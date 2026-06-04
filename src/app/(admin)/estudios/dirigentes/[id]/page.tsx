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
        <div className="card" style={{ padding: 22 }}>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', textAlign: 'center', padding: '32px 0', fontFamily: 'var(--font-body)' }}>
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
            className="relative rounded-2xl p-6 max-w-lg w-full mx-4 space-y-6 overflow-y-auto max-h-[90vh]"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                Editar dirigente — {leader.member_name}
              </h2>
              <button onClick={() => setEditOpen(false)} className="text-navy-light/40 hover:text-navy transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* ── Sección 1: Estudios que puede impartir ── */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Estudios que puede impartir
              </p>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {qualifications.length === 0 && (
                  <span className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                    Sin estudios asignados
                  </span>
                )}
                {qualifications.map(code => {
                  const study = STUDY_CATALOG.find(s => s.code === code)
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 rounded-full bg-navy/8 px-3 py-1 text-[12px] font-medium text-navy"
                      style={{ fontFamily: 'var(--font-display)' }}
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
                  className="flex-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  style={{ fontFamily: 'var(--font-body)' }}
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
                  className="inline-flex items-center gap-1 rounded-full bg-coral px-3 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <Plus size={13} /> Agregar
                </button>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--outline-variant)' }} />

            {/* ── Sección 2: Zonas de preferencia ── */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
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
                          : 'border-transparent text-navy-light/60 hover:bg-surface-low'
                      )}
                      style={{
                        borderColor: selected ? undefined : 'var(--outline-variant)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {selected ? '✓ ' : ''}{sede.name}
                    </button>
                  )
                })}
              </div>
              {zones.length === 0 && (
                <p className="text-[11px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                  Seleccioná al menos una zona
                </p>
              )}
              {zones.length > 0 && (
                <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  {zones.length} zona{zones.length !== 1 ? 's' : ''} seleccionada{zones.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--outline-variant)' }} />

            {/* ── Sección 3: Estado de disponibilidad ── */}
            <div className="space-y-3">
              <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
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
                        <p className="text-[12px] text-navy-light/60 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
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
                className="rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={zones.length === 0}
                className="rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="ph">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ marginBottom: 10 }}>
          ← Volver a dirigentes
        </button>
        <div className="ph-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {[
          { label: 'Grupos liderados',      value: leader.stats.groups_led },
          { label: 'Calificación prom.',    value: `${leader.stats.avg_rating.toFixed(1)} / 5` },
          { label: 'Participantes activos', value: leader.stats.current_participants },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '18px 22px' }}>
            <div className="st">{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-navy)', fontFamily: 'var(--font-display)', marginTop: 8 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs card ── */}
      <div className="card" style={{ width: '100%' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(22,20,64,0.09)', padding: '0 22px' }}>
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                'px-4 py-3 text-sm transition-all border-b-2 -mb-px',
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
          <div>
            <div className="card-hd">
              <div className="card-title">Grupos liderados ({leaderGroups.length})</div>
            </div>
            {leaderGroups.length === 0 ? (
              <div style={{ padding: '40px 22px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'rgba(41,54,92,0.4)', fontFamily: 'var(--font-body)' }}>Sin grupos registrados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(22,20,64,0.09)' }}>
                      {['Estudio', 'Zona', 'Participantes', 'Estado'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/50" style={{ fontFamily: 'var(--font-display)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderGroups.map(g => (
                      <tr key={g.id} className="hover:bg-surface-low transition-colors" style={{ borderBottom: '1px solid rgba(22,20,64,0.06)' }}>
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
              </div>
            )}
          </div>
        )}

      {/* Tab: Evaluaciones */}
      {activeTab === 'evaluaciones' && (
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
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
              <div className="flex-1">
                {/* Título de la sección */}
                <div className="st" style={{ marginBottom: 16 }}>
                  Evaluaciones por grupo
                </div>

                {/* Gráfico de barras */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 12,
                  height: 120,
                  paddingTop: 24,
                  marginBottom: 20,
                }}>
                  {leader.evaluations?.map((ev, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      flex: 1,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-navy)' }}>
                        {ev.score}
                      </span>
                      <div style={{
                        width: '100%',
                        height: `${(ev.score / 5) * 80}px`,
                        background: ev.score <= 2 ? 'var(--brand-coral)' : 'var(--brand-teal)',
                        borderRadius: '6px 6px 0 0',
                        minHeight: 8,
                      }} />
                      <span style={{
                        fontSize: 10,
                        color: 'var(--fg-muted)',
                        textAlign: 'center',
                        maxWidth: 60,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {ev.group_name || `Grupo ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {leader.evaluations.map(ev => (
              <div
                key={ev.id}
                style={{ borderRadius: 14, padding: '14px 16px', background: 'var(--surface-low)' }}
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
                    <p className="text-[12px] text-navy-light/50 mt-1" style={{ fontFamily: 'var(--font-body)' }}>{ev.group_name}</p>
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
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <div className="st" style={{ marginBottom: 8 }}>Puede impartir</div>
            <div className="flex flex-wrap gap-1.5">
              {qualifications.map(code => (
                <StudyTypeBadge key={code} code={code} size="md" />
              ))}
              {qualifications.length === 0 && (
                <p style={{ fontSize: 13, color: 'rgba(41,54,92,0.4)', fontFamily: 'var(--font-body)' }}>Sin estudios registrados.</p>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(22,20,64,0.09)', paddingTop: 16 }}>
            <div className="st" style={{ marginBottom: 6 }}>Zonas de preferencia</div>
            <p style={{ fontSize: 13, color: 'var(--brand-navy)', fontFamily: 'var(--font-body)' }}>
              {zones.length > 0 ? zones.map(z => sedeLabel(z)).join(' · ') : '—'}
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(22,20,64,0.09)', paddingTop: 16 }}>
            <div className="st" style={{ marginBottom: 6 }}>Estado de disponibilidad</div>
            <span className={cn('rounded-md px-2.5 py-1 text-[12px] font-medium', avail.className)}>
              {avail.label}
            </span>
          </div>

          <div style={{ borderTop: '1px solid rgba(22,20,64,0.09)', paddingTop: 16 }}>
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm text-coral hover:text-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
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

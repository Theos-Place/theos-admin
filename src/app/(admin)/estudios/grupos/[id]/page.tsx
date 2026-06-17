'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGroup } from '@/hooks/useGroup'
import { sedeLabel } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge, NoLeaderBadge, LeaderTrainingBadge } from '@/components/studies/GroupStatusBadge'
import { WeekProgressBar } from '@/components/studies/WeekProgressBar'
import { cn } from '@/lib/utils'
import { ChevronLeft, Plus, MessageCircle, Send, Edit2, Users } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { getInitials } from '@/lib/format'

function AttendanceBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-teal-deep' : pct >= 40 ? 'bg-amber-400' : 'bg-coral'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-surface-low overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-navy-light/60 font-body">{pct}%</span>
    </div>
  )
}

function AddMemberModal({ groupId, enrolledIds, onClose, onEnrolled }: {
  groupId: string
  enrolledIds: Set<string>
  onClose: () => void
  onEnrolled: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; first_name: string; last_name: string; cedula: string | null }[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let alive = true
    const t = setTimeout(() => {
      fetch(`/api/members?search=${encodeURIComponent(q)}&pageSize=6`)
        .then(r => (r.ok ? r.json() : { members: [] }))
        .then(d => { if (alive) setResults(d.members ?? []) })
        .catch(() => { if (alive) setResults([]) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [query])

  async function enroll(memberId: string) {
    setAdding(memberId)
    try {
      const res = await fetch(`/api/studies/groups/${groupId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onEnrolled()
      onClose()
    } catch (err) {
      console.error('No se pudo inscribir al miembro:', err)
      setAdding(null)
    }
  }

  return (
    <Modal onClose={onClose} titleId="anadir-miembro-title" width={384}>
      <div className="p-5 space-y-4">
        <h3 id="anadir-miembro-title" className="font-semibold text-navy font-display">
          Añadir miembro
        </h3>
        <input
          autoFocus
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          placeholder="Buscar por nombre o cédula..."
          aria-label="Buscar por nombre o cédula"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {results.map(m => {
            const already = enrolledIds.has(m.id)
            return (
              <button
                key={m.id}
                disabled={already || adding === m.id}
                onClick={() => enroll(m.id)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-low text-left transition-colors disabled:opacity-50"
              >
                <div className="h-8 w-8 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy shrink-0">
                  {getInitials(`${m.first_name} ${m.last_name}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy font-body">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-[11px] text-navy-light/60">{m.cedula ?? 'Sin cédula'}</p>
                </div>
                {already && <span className="text-[11px] text-navy-light/60">Ya inscrito</span>}
                {adding === m.id && <span className="text-[11px] text-navy-light/60">…</span>}
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}

function SendMessageModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <Modal onClose={onClose} titleId="mensaje-enviado-title" width={384}>
        <div className="p-6 text-center space-y-3">
          <Send size={32} className="text-teal-deep mx-auto" />
          <p id="mensaje-enviado-title" className="font-semibold text-navy font-display">Mensaje enviado</p>
          <button onClick={onClose} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors">
            Cerrar
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} titleId="enviar-mensaje-grupo-title" width={384}>
      <div className="p-5 space-y-4">
        <h3 id="enviar-mensaje-grupo-title" className="font-semibold text-navy font-display">Enviar mensaje al grupo</h3>
        <div className="flex gap-2">
          {['whatsapp', 'email'].map(c => (
            <button
              key={c}
              onClick={() => setChannel(c as 'whatsapp' | 'email')}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-all',
                channel === c ? 'bg-navy text-white border-navy' : 'text-navy-light hover:bg-surface-low',
                'border-[var(--outline-variant)] font-display',
              )}
            >
              {c === 'whatsapp' ? 'WhatsApp' : 'Correo'}
            </button>
          ))}
        </div>
        <textarea
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
          rows={4}
          placeholder="Escribe tu mensaje..."
          value={msg}
          onChange={e => setMsg(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setSent(true)}
            disabled={!msg.trim()}
            className="flex-1 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
          >
            Enviar
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function GrupoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { group, studyTypes, refetch, loading } = useGroup(id)
  const [activeTab, setActiveTab] = useState('participantes')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSendMessage, setShowSendMessage] = useState(false)
  const [waUrl, setWaUrl] = useState(group?.whatsapp_group_url ?? '')
  const [waInput, setWaInput] = useState('')
  const [sessions, setSessions] = useState<Array<{ id: string; date: string; topic: string | null; present: number; total: number }>>([])

  useEffect(() => {
    if (!id) return
    let alive = true
    fetch(`/api/studies/groups/${id}/sessions`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) setSessions(Array.isArray(d) ? d : []) })
      .catch(() => { if (alive) setSessions([]) })
    return () => { alive = false }
  }, [id])

  if (loading) {
    return (
      <div className="py-16 text-center font-body">
        <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
        <p className="text-sm text-navy-light/60">Cargando…</p>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/grupos" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Grupos
        </Link>
        <p className="text-navy-light/60 font-body">Grupo no encontrado.</p>
      </div>
    )
  }

  const studyType = studyTypes.find(s => s.id === group.study_type_id) ?? null
  const enrolled = group.participants.filter(p => p.status !== 'withdrawn')
  const tabs = ['información', 'participantes', 'asistencia', 'comunicaciones']
  const tabLabels: Record<string, string> = {
    participantes: 'Participantes',
    asistencia: 'Asistencia',
    comunicaciones: 'Comunicaciones',
    información: 'Información',
  }

  return (
    <div className="space-y-5">
      {showAddMember && (
        <AddMemberModal
          groupId={id}
          enrolledIds={new Set((group?.participants ?? []).map(p => p.member_id))}
          onClose={() => setShowAddMember(false)}
          onEnrolled={refetch}
        />
      )}
      {showSendMessage && <SendMessageModal onClose={() => setShowSendMessage(false)} />}

      {/* Back */}
      <Link
        href="/estudios/grupos"
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Grupos
      </Link>

      {/* Header card */}
      <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StudyTypeBadge code={group.study_type_id} name={studyType?.name} size="md" />
              <GroupStatusBadge status={group.status} />
              {group.is_leader_training && <LeaderTrainingBadge modality={group.training_modality} />}
              {!group.leader_id && group.status !== 'finalizado' && <NoLeaderBadge />}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-navy-light/60 font-body">
              <span>Dirigente: <strong className="text-navy">{group.leader_name ?? 'Sin asignar'}</strong></span>
              {group.co_leader_name && (
                <span>Co-dirigente: <strong className="text-navy">{group.co_leader_name}</strong></span>
              )}
              <span>Zona: <strong className="text-navy">{sedeLabel(group.zone)}</strong></span>
              <span>Horario: <strong className="text-navy">{group.schedule_days.join('/')} {group.schedule_time}</strong></span>
            </div>
            {studyType && group.current_week > 0 && group.status !== 'finalizado' && (
              <WeekProgressBar current={group.current_week} total={studyType.weeks} className="w-48" />
            )}
          </div>
          <div className="flex gap-2">
            {group.status === 'en_curso' && (
              <Link
                href={`/estudios/grupos/${id}/cierre`}
                className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
              >
                Cierre de estudio
              </Link>
            )}
            <Link
              href={`/estudios/grupos/${id}/editar`}
              className="rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors flex items-center border-[var(--outline-variant)] font-body"
            >
              <Edit2 size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--outline-variant)] overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm transition-all border-b-2 -mb-px shrink-0 whitespace-nowrap',
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

      {/* Tab: Participantes */}
      {activeTab === 'participantes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-navy-light/60 font-body">
              {enrolled.length} inscritos de {group.max_capacity} lugares
            </p>
            <button
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors"
            >
              <Plus size={12} /> Añadir miembro
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)] overflow-x-auto">
            <table className="w-full border-collapse min-w-[480px]">
              <thead>
                <tr>
                  {['Nombre', 'Estado', 'Asistencia', studyType?.requires_grade ? 'Nota' : '', 'Acciones'].filter(Boolean).map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.participants.map(p => (
                  <tr
                    key={p.member_id}
                    className="hover:bg-surface-low transition-colors border-b border-[var(--outline-variant)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy">
                          {getInitials(p.member_name)}
                        </div>
                        <span className="text-sm text-navy font-body">
                          {p.member_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {group.status === 'finalizado' ? (
                        <span className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-medium',
                          p.status === 'withdrawn' ? 'bg-coral/15 text-coral' : 'bg-teal-soft/30 text-teal-deep'
                        )}>
                          {p.status === 'withdrawn' ? 'Reprobó' : 'Aprobado'}
                        </span>
                      ) : (
                        <span className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-medium',
                          p.status === 'enrolled' ? 'bg-teal-soft/30 text-teal-deep' :
                          p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-surface-low text-navy-light/60'
                        )}>
                          {p.status === 'enrolled' ? 'Inscrito' : p.status === 'pending' ? 'Pendiente' : 'Retirado'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceBar pct={p.attendance_pct} />
                    </td>
                    {studyType?.requires_grade && (
                      <td className="px-4 py-3 text-sm text-navy-light/70 font-body">
                        {p.grade ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {group.status !== 'finalizado' && (
                          <button
                            className="rounded-lg px-2 py-1 text-[10px] text-coral border border-coral/20 hover:bg-coral/5 transition-colors font-body"
                          >
                            Desinscribir
                          </button>
                        )}
                        <Link
                          href={`/miembros/${p.member_id}`}
                          className="rounded-lg px-2 py-1 text-[10px] text-navy-light border hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
                        >
                          Perfil
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* WhatsApp section */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <h3
              className="text-[10px] tracking-widest uppercase text-navy-light/60 mb-3 font-display"
            >
              Grupo de WhatsApp
            </h3>
            {waUrl ? (
              <div className="flex items-center gap-3">
                <MessageCircle size={16} className="text-teal-deep" />
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-teal-deep hover:underline font-body">
                  Ver grupo de WhatsApp
                </a>
              </div>
            ) : group.status === 'finalizado' ? (
              <p className="text-sm text-navy-light/60 font-body">
                Grupo finalizado — sin grupo de WhatsApp.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-navy-light/60 font-body">
                  Crea el grupo en WhatsApp y pega el link de invitación aquí.
                </p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                    placeholder="https://chat.whatsapp.com/..."
                    value={waInput}
                    onChange={e => setWaInput(e.target.value)}
                  />
                  <button
                    onClick={() => { if (waInput) setWaUrl(waInput) }}
                    className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Asistencia */}
      {activeTab === 'asistencia' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/estudios/grupos/${id}/asistencia`}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
            >
              <Users size={14} /> Pasar lista hoy
            </Link>
          </div>

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)] overflow-x-auto">
            {sessions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-navy-light/60 font-body">
                  No tenemos asistencia registrada para este grupo.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Sesión', 'Fecha', 'Asistencia'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr
                      key={s.id}
                      className="hover:bg-surface-low transition-colors border-b border-[var(--outline-variant)]"
                    >
                      <td className="px-4 py-3 text-sm text-navy font-body">
                        Sesión {i + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-light/70 font-body">
                        {new Date(s.date).toLocaleDateString('es-CR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy font-body">
                        {s.present}/{s.total} presentes
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Comunicaciones */}
      {activeTab === 'comunicaciones' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowSendMessage(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
            >
              <Send size={14} /> Enviar mensaje
            </button>
          </div>

          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
            <EmptyState icon={MessageCircle} title="No hay comunicaciones registradas para este grupo" />
          </div>
        </div>
      )}

      {/* Tab: Información */}
      {activeTab === 'información' && (
        <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Tipo de estudio', value: `${group.study_type_id} — ${studyType?.name}` },
              { label: 'Zona', value: sedeLabel(group.zone) },
              { label: 'Días', value: group.schedule_days.join(', ') },
              { label: 'Horario', value: group.schedule_time },
              { label: 'Ubicación', value: group.location },
              { label: 'Capacidad máxima', value: `${group.max_capacity} personas` },
              { label: 'Fecha de inicio', value: group.start_date },
              { label: 'Fecha de cierre', value: group.end_date ?? '—' },
              { label: 'Semana actual', value: group.status === 'finalizado' ? 'N/A' : `${group.current_week} de ${studyType?.weeks ?? '?'}` },
              { label: 'Dirigente', value: group.leader_name ?? 'Sin asignar' },
              { label: 'Co-dirigente', value: group.co_leader_name ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p
                  className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
                >
                  {label}
                </p>
                <p className="text-sm text-navy font-body">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {group.status !== 'finalizado' && (
            <div className="flex gap-2 pt-2 border-t border-[var(--outline-variant)]">
              <button
                className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
              >
                Cambiar dirigente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

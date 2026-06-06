'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import { sedeLabel } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { WeekProgressBar } from '@/components/studies/WeekProgressBar'
import { cn } from '@/lib/utils'
import { ChevronLeft, Plus, MessageCircle, Send, Edit2, Users } from 'lucide-react'

const FAKE_MESSAGES = [
  { date: '2025-04-12', channel: 'WhatsApp', content: 'Recordatorio: sesión de esta semana el miércoles a las 7:30pm. ¡No falten! 📖' },
  { date: '2025-04-05', channel: 'WhatsApp', content: 'Hola grupo! Les comparto el material de la próxima sesión. Léanlo con anticipación.' },
  { date: '2025-03-29', channel: 'Correo', content: 'Resumen del primer mes del grupo: asistencia promedio 78%, excelente participación.' },
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function AttendanceBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-teal-deep' : pct >= 40 ? 'bg-amber-400' : 'bg-coral'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-surface-low overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>{pct}%</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <h3 className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
          Añadir miembro
        </h3>
        <input
          autoFocus
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
          placeholder="Buscar por nombre o cédula..."
          style={{ fontFamily: 'var(--font-body)' }}
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
                  <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-[11px] text-navy-light/50">{m.cedula ?? 'Sin cédula'}</p>
                </div>
                {already && <span className="text-[11px] text-navy-light/40">Ya inscrito</span>}
                {adding === m.id && <span className="text-[11px] text-navy-light/40">…</span>}
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function SendMessageModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative rounded-2xl p-6 max-w-sm w-full mx-4 text-center space-y-3"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
        >
          <Send size={32} className="text-teal-deep mx-auto" />
          <p className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Mensaje enviado</p>
          <button onClick={onClose} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <h3 className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Enviar mensaje al grupo</h3>
        <div className="flex gap-2">
          {['whatsapp', 'email'].map(c => (
            <button
              key={c}
              onClick={() => setChannel(c as 'whatsapp' | 'email')}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-all',
                channel === c ? 'bg-navy text-white border-navy' : 'text-navy-light hover:bg-surface-low'
              )}
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-display)' }}
            >
              {c === 'whatsapp' ? 'WhatsApp' : 'Correo'}
            </button>
          ))}
        </div>
        <textarea
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none"
          style={{ fontFamily: 'var(--font-body)' }}
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
            className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GrupoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { groups, studyTypes, refetch } = useStudies()
  const group = groups.find(g => g.id === id)
  const [activeTab, setActiveTab] = useState('participantes')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSendMessage, setShowSendMessage] = useState(false)
  const [waUrl, setWaUrl] = useState(group?.whatsapp_group_url ?? '')
  const [waInput, setWaInput] = useState('')

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

  const studyType = studyTypes.find(s => s.id === group.study_type_id) ?? null
  const enrolled = group.participants.filter(p => p.status !== 'withdrawn')
  const tabs = ['participantes', 'asistencia', 'comunicaciones', 'información']
  const tabLabels: Record<string, string> = {
    participantes: 'Participantes',
    asistencia: 'Asistencia',
    comunicaciones: 'Comunicaciones',
    información: 'Información',
  }

  const fakeSessions = Array.from({ length: group.current_week }, (_, i) => ({
    session: i + 1,
    date: new Date(new Date(group.start_date).getTime() + i * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CR'),
    present: Math.round(enrolled.length * 0.75 + Math.random() * enrolled.length * 0.2),
  }))

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
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronLeft size={16} /> Grupos
      </Link>

      {/* Header card */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StudyTypeBadge code={group.study_type_id} name={studyType?.name} size="md" />
              <GroupStatusBadge status={group.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              <span>Dirigente: <strong className="text-navy">{group.leader_name ?? 'Sin asignar'}</strong></span>
              <span>Zona: <strong className="text-navy">{sedeLabel(group.zone)}</strong></span>
              <span>Horario: <strong className="text-navy">{group.schedule_days.join('/')} {group.schedule_time}</strong></span>
            </div>
            {studyType && group.current_week > 0 && (
              <WeekProgressBar current={group.current_week} total={studyType.weeks} className="w-48" />
            )}
          </div>
          <div className="flex gap-2">
            {group.status === 'in_progress' && (
              <Link
                href={`/estudios/grupos/${id}/cierre`}
                className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Cerrar grupo
              </Link>
            )}
            <button
              className="rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Edit2 size={14} />
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

      {/* Tab: Participantes */}
      {activeTab === 'participantes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              {enrolled.length} inscritos de {group.max_capacity} lugares
            </p>
            <button
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors"
            >
              <Plus size={12} /> Añadir miembro
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Nombre', 'Estado', 'Asistencia', studyType?.requires_grade ? 'Nota' : '', 'Acciones'].filter(Boolean).map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50"
                      style={{ fontFamily: 'var(--font-display)' }}
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
                    className="hover:bg-surface-low transition-colors"
                    style={{ borderBottom: '1px solid var(--outline-variant)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy">
                          {getInitials(p.member_name)}
                        </div>
                        <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                          {p.member_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-medium',
                        p.status === 'enrolled' ? 'bg-teal-soft/30 text-teal-deep' :
                        p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-surface-low text-navy-light/40'
                      )}>
                        {p.status === 'enrolled' ? 'Inscrito' : p.status === 'pending' ? 'Pendiente' : 'Retirado'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceBar pct={p.attendance_pct} />
                    </td>
                    {studyType?.requires_grade && (
                      <td className="px-4 py-3 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                        {p.grade ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded-lg px-2 py-1 text-[10px] text-coral border border-coral/20 hover:bg-coral/5 transition-colors"
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          Desinscribir
                        </button>
                        <Link
                          href={`/miembros/${p.member_id}`}
                          className="rounded-lg px-2 py-1 text-[10px] text-navy-light border hover:bg-surface-low transition-colors"
                          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
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
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <h3
              className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Grupo de WhatsApp
            </h3>
            {waUrl ? (
              <div className="flex items-center gap-3">
                <MessageCircle size={16} className="text-teal-deep" />
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-teal-deep hover:underline" style={{ fontFamily: 'var(--font-body)' }}>
                  Ver grupo de WhatsApp
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                  Crea el grupo en WhatsApp y pega el link de invitación aquí.
                </p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                    placeholder="https://chat.whatsapp.com/..."
                    style={{ fontFamily: 'var(--font-body)' }}
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

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            {fakeSessions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                  El grupo aún no ha comenzado.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Sesión', 'Fecha', 'Asistencia', ''].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fakeSessions.map(s => (
                    <tr
                      key={s.session}
                      className="hover:bg-surface-low transition-colors"
                      style={{ borderBottom: '1px solid var(--outline-variant)' }}
                    >
                      <td className="px-4 py-3 text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                        Sesión {s.session}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                        {s.date}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                        {s.present}/{enrolled.length} presentes
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-[11px] text-navy-light hover:text-coral transition-colors"
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          Ver detalle
                        </button>
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

          <div className="space-y-3">
            {FAKE_MESSAGES.map((msg, i) => (
              <div
                key={i}
                className="rounded-2xl p-4"
                style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    'rounded-md px-2 py-0.5 text-[10px] font-medium',
                    msg.channel === 'WhatsApp' ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy/10 text-navy'
                  )}>
                    {msg.channel}
                  </span>
                  <span className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                    {msg.date}
                  </span>
                </div>
                <p className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Información */}
      {activeTab === 'información' && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
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
              { label: 'Semana actual', value: `${group.current_week} de ${studyType?.weeks ?? '?'}` },
              { label: 'Dirigente', value: group.leader_name ?? 'Sin asignar' },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p
                  className="text-[10px] tracking-widest uppercase text-navy-light/40"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {label}
                </p>
                <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
            <button
              className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Cambiar dirigente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

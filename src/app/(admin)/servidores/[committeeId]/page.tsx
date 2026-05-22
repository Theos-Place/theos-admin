'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MOCK_COMMITTEES, MOCK_VACANCIES, MOCK_COMMITTEE_GOALS,
  type CommitteeServer, type CommitteeGoal,
} from '@/data/mock-servers'
import { SERVICE_POSITIONS } from '@/data/mock-committees'
import { cn } from '@/lib/utils'
import { SortableHeader } from '@/components/shared/SortableHeader'
import { useSortableTable } from '@/hooks/useSortableTable'
import {
  ChevronLeft, Plus, X, Check, MoreVertical,
  Search, ExternalLink,
} from 'lucide-react'

function calcularAntiguedad(startDate: string): string {
  const inicio = new Date(startDate)
  const hoy = new Date()
  const meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth())
  if (meses < 12) return `${meses} meses`
  const años = Math.floor(meses / 12)
  const mesesRest = meses % 12
  return mesesRest > 0
    ? `${años} año${años > 1 ? 's' : ''} y ${mesesRest} meses`
    : `${años} año${años > 1 ? 's' : ''}`
}

type Tab = 'miembros' | 'vacantes' | 'metas'
type StatusFilter = 'active' | 'inactive' | 'all'
type DisconnectReason = 'renuncia' | 'cambio' | 'fin-periodo' | 'otro'

const DISCONNECT_REASONS: { value: DisconnectReason; label: string }[] = [
  { value: 'renuncia',     label: 'Renuncia voluntaria' },
  { value: 'cambio',       label: 'Cambio de comité' },
  { value: 'fin-periodo',  label: 'Fin de período' },
  { value: 'otro',         label: 'Otro' },
]

export default function CommitteeDetailPage() {
  const { committeeId } = useParams<{ committeeId: string }>()
  const router = useRouter()

  const committee = useMemo(
    () => MOCK_COMMITTEES.find(c => c.id === committeeId),
    [committeeId]
  )

  const [tab, setTab] = useState<Tab>('miembros')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  // Server row menu
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Disconnect modal
  const [disconnectTarget, setDisconnectTarget] = useState<CommitteeServer | null>(null)
  const [disconnectReason, setDisconnectReason] = useState<DisconnectReason>('renuncia')
  const [disconnectOtherReason, setDisconnectOtherReason] = useState('')
  const [disconnectDate, setDisconnectDate] = useState(new Date().toISOString().split('T')[0])
  const [disconnected, setDisconnected] = useState<string[]>([])

  // Goals (local state)
  const initialGoals = MOCK_COMMITTEE_GOALS[committeeId] ?? []
  const [goals, setGoals] = useState<CommitteeGoal[]>(initialGoals)
  const [newGoalText, setNewGoalText] = useState('')
  const [newGoalDate, setNewGoalDate] = useState('')
  const [showGoalForm, setShowGoalForm] = useState(false)

  const committeeVacancies = useMemo(
    () => MOCK_VACANCIES.filter(v => v.committee_id === committeeId),
    [committeeId]
  )

  const displayedMembers = useMemo(
    () => !committee ? [] : committee.members.filter(m => {
      if (disconnected.includes(m.member_id)) return false
      const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || m.status === statusFilter
      return matchSearch && matchStatus
    }),
    [committee, disconnected, search, statusFilter]
  )

  const activeCount = useMemo(
    () => !committee ? 0 : committee.members.filter(m => m.status === 'active' && !disconnected.includes(m.member_id)).length,
    [committee, disconnected]
  )

  const { sorted: sortedMembers, sortKey: memberSortKey, sortDir: memberSortDir, toggleSort: toggleMemberSort } = useSortableTable(displayedMembers)

  if (!committee) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Comité no encontrado.
        </p>
      </div>
    )
  }

  function handleDisconnect() {
    if (!disconnectTarget) return
    setDisconnected(prev => [...prev, disconnectTarget!.member_id])
    setDisconnectTarget(null)
  }

  function addGoal() {
    if (!newGoalText.trim()) return
    setGoals(prev => [...prev, {
      id: `g-new-${Date.now()}`,
      description: newGoalText.trim(),
      status: 'in_progress',
      due_date: newGoalDate || null,
    }])
    setNewGoalText('')
    setNewGoalDate('')
    setShowGoalForm(false)
  }

  function toggleGoal(id: string) {
    setGoals(prev => prev.map(g =>
      g.id === id ? { ...g, status: g.status === 'completed' ? 'in_progress' : 'completed' } : g
    ))
  }

  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="ph">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/servidores')} style={{ marginBottom: 10 }}>
          ← Volver a servidores
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">{committee.name}</div>
            <div className="psub">
              {committee.area} · {activeCount} servidor{activeCount !== 1 ? 'es' : ''} activo{activeCount !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center">
                <span className="text-[10px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  {committee.leader.initials}
                </span>
              </div>
              <span style={{ fontSize: 13, color: 'rgba(41,54,92,0.7)', fontFamily: 'var(--font-body)' }}>
                {committee.leader.name}
              </span>
              <Link
                href={`/miembros/${committee.leader.member_id}`}
                className="text-[11px] text-coral hover:underline"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Ver perfil
              </Link>
            </div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost btn-sm">Editar comité</button>
            <button className="btn btn-primary btn-sm">
              <Plus size={13} /> Añadir servidor
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs card ── */}
      <div className="card" style={{ width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(22,20,64,0.09)', padding: '0 4px' }}>
        {(['miembros', 'vacantes', 'metas'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-3 text-sm capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-coral text-navy font-semibold'
                : 'border-transparent text-navy-light/50 hover:text-navy'
            )}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t === 'miembros' ? `Miembros` : t === 'vacantes' ? `Vacantes (${committeeVacancies.length})` : 'Metas'}
          </button>
        ))}
      </div>{/* end tab bar */}

      {/* Tab: Miembros */}
      {tab === 'miembros' && (
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
              <input
                className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Buscar por nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex rounded-full p-1 gap-0.5" style={{ background: 'var(--surface-low)' }}>
              {([['active', 'Activos'], ['inactive', 'Inactivos'], ['all', 'Todos']] as [StatusFilter, string][]).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[12px] transition-all duration-150',
                    statusFilter === v ? 'bg-navy text-white' : 'text-navy-light/60 hover:text-navy'
                  )}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Plus size={13} />
              Añadir servidor
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden" style={{ borderRadius: 12, border: '1px solid rgba(22,20,64,0.09)' }}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                    <SortableHeader label="Servidor"   sortKey="name"       currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                    <SortableHeader label="Puesto"     sortKey="position"   currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                    <SortableHeader label="Inicio"     sortKey="start_date" currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                    <SortableHeader label="Antigüedad" sortKey="seniority"  currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                    <SortableHeader label="Estado"     sortKey="status"     currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m, idx) => (
                    <tr
                      key={m.member_id}
                      className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                              {m.initials}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                            {m.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-navy-light/70 max-w-[180px]" style={{ fontFamily: 'var(--font-body)' }}>
                        {m.position}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-navy-light/60 whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                        {new Date(m.start_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-navy-light/60 whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                        {calcularAntiguedad(m.start_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            m.status === 'active'
                              ? 'bg-teal-deep/10 text-teal-deep'
                              : 'bg-navy-light/10 text-navy-light/50'
                          )}
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {m.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === m.member_id ? null : m.member_id)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/40 hover:text-navy hover:bg-surface-low transition-colors"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openMenu === m.member_id && (
                            <div
                              className="absolute right-0 top-8 z-20 w-44 rounded-xl overflow-hidden shadow-lg"
                              style={{ background: 'var(--surface-card)', border: '1px solid var(--outline-variant)' }}
                            >
                              <Link
                                href={`/miembros/${m.member_id}`}
                                onClick={() => setOpenMenu(null)}
                                className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-navy hover:bg-surface-low transition-colors"
                                style={{ fontFamily: 'var(--font-body)' }}
                              >
                                <ExternalLink size={13} />
                                Ver perfil
                              </Link>
                              <button
                                onClick={() => { setOpenMenu(null) }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-navy hover:bg-surface-low transition-colors"
                                style={{ fontFamily: 'var(--font-body)' }}
                              >
                                Cambiar puesto
                              </button>
                              <button
                                onClick={() => { setDisconnectTarget(m); setOpenMenu(null) }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-coral hover:bg-coral/5 transition-colors"
                                style={{ fontFamily: 'var(--font-body)' }}
                              >
                                Desvincular
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedMembers.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                  No hay servidores con ese filtro.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Vacantes */}
      {tab === 'vacantes' && (
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="flex justify-end">
            <Link
              href={`/servidores/vacantes/nueva?comite=${committeeId}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Plus size={13} />
              Solicitar nueva vacante
            </Link>
          </div>

          {committeeVacancies.length === 0 && (
            <div
              className="rounded-xl px-5 py-10 text-center"
              style={{ background: 'var(--surface-low)' }}
            >
              <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                No hay vacantes para este comité.
              </p>
            </div>
          )}

          {committeeVacancies.map(v => {
            const statusColors: Record<string, string> = {
              draft: 'bg-navy-light/10 text-navy-light/50',
              published: 'bg-teal-deep/10 text-teal-deep',
              filled: 'bg-navy/10 text-navy',
              closed: 'bg-coral/10 text-coral',
            }
            const statusLabels: Record<string, string> = {
              draft: 'Borrador', published: 'Publicada', filled: 'Ocupada', closed: 'Cerrada',
            }
            return (
              <Link
                key={v.id}
                href={`/servidores/vacantes/${v.id}`}
                className="block rounded-2xl px-5 py-4 hover:shadow-lg transition-all duration-150"
                style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                      {v.title}
                    </p>
                    <p className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                      {v.position}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>
                      {v.slots_filled}/{v.slots_total} cupos
                    </span>
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', statusColors[v.status])}
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {statusLabels[v.status]}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Tab: Metas */}
      {tab === 'metas' && (
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {goals.map(g => (
            <div
              key={g.id}
              className="flex items-start gap-3 rounded-2xl px-5 py-4"
              style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
            >
              <button
                onClick={() => toggleGoal(g.id)}
                className={cn(
                  'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                  g.status === 'completed'
                    ? 'bg-teal-deep border-teal-deep'
                    : 'border-navy-light/30 hover:border-teal-deep'
                )}
              >
                {g.status === 'completed' && <Check size={10} className="text-white" strokeWidth={3} />}
              </button>
              <div className="flex-1 space-y-0.5">
                <p
                  className={cn(
                    'text-sm text-navy',
                    g.status === 'completed' && 'line-through text-navy-light/40'
                  )}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {g.description}
                </p>
                {g.due_date && (
                  <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    Límite: {new Date(g.due_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0',
                  g.status === 'completed' ? 'bg-teal-deep/10 text-teal-deep' : 'bg-amber-500/10 text-amber-600'
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {g.status === 'completed' ? 'Completada' : 'En progreso'}
              </span>
            </div>
          ))}

          {showGoalForm ? (
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
            >
              <textarea
                className={cn(inputCls, 'resize-none')}
                style={{ fontFamily: 'var(--font-body)' }}
                rows={2}
                placeholder="Descripción de la meta..."
                value={newGoalText}
                onChange={e => setNewGoalText(e.target.value)}
                autoFocus
              />
              <div className="space-y-1">
                <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Fecha límite (opcional)
                </label>
                <input
                  type="date"
                  className={inputCls}
                  style={{ fontFamily: 'var(--font-body)' }}
                  value={newGoalDate}
                  onChange={e => setNewGoalDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addGoal}
                  className="rounded-full bg-navy px-4 py-1.5 text-[12px] text-white hover:bg-navy/80 transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Agregar meta
                </button>
                <button
                  onClick={() => setShowGoalForm(false)}
                  className="rounded-full border px-4 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowGoalForm(true)}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Plus size={13} />
              Agregar meta
            </button>
          )}

          {goals.length === 0 && !showGoalForm && (
            <p className="text-[12px] text-navy-light/40 text-center py-6" style={{ fontFamily: 'var(--font-body)' }}>
              No hay metas definidas aún.
            </p>
          )}
        </div>
      )}

      {/* Disconnect modal */}
      {disconnectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                  Desvincular servidor
                </p>
                <p className="text-sm text-navy-light/60 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                  {disconnectTarget.name}
                </p>
              </div>
              <button
                onClick={() => setDisconnectTarget(null)}
                className="text-navy-light/40 hover:text-navy transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Motivo
                </label>
                <select
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  style={{ fontFamily: 'var(--font-body)' }}
                  value={disconnectReason}
                  onChange={e => setDisconnectReason(e.target.value as DisconnectReason)}
                >
                  {DISCONNECT_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {disconnectReason === 'otro' && (
                <div className="space-y-1">
                  <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                    Especificar motivo
                  </label>
                  <input
                    className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                    style={{ fontFamily: 'var(--font-body)' }}
                    placeholder="Describe el motivo..."
                    value={disconnectOtherReason}
                    onChange={e => setDisconnectOtherReason(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Fecha efectiva de salida
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  style={{ fontFamily: 'var(--font-body)' }}
                  value={disconnectDate}
                  onChange={e => setDisconnectDate(e.target.value)}
                />
              </div>
            </div>

            <div
              className="rounded-xl px-3 py-2.5 text-[12px] text-amber-700 bg-amber-50"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Esta acción moverá al servidor al historial del comité.
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDisconnectTarget(null)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDisconnect}
                className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Confirmar salida
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* end .card tabs */}
    </div>
  )
}

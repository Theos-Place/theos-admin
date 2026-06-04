'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { CommitteeServer, CommitteeGoal, CommitteeData } from '@/types/server'
import { useServers } from '@/hooks/useServers'
import { mockMembers } from '@/data/mock-members'
import { cn } from '@/lib/utils'
import { useSortableTable } from '@/hooks/useSortableTable'
import { CommitteeHeader } from './_components/CommitteeHeader'
import { MembersTab } from './_components/MembersTab'
import { VacanciesTab } from './_components/VacanciesTab'
import { GoalsTab } from './_components/GoalsTab'
import {
  DisconnectModal,
  EditCommitteeModal,
  AddServerModal,
  ChangePositionModal,
  type CommitteeFormState,
} from './_components/CommitteeModals'

type Tab = 'miembros' | 'vacantes' | 'metas'
type StatusFilter = 'active' | 'inactive' | 'all'
type DisconnectReason = 'renuncia' | 'cambio' | 'fin-periodo' | 'otro'

export default function CommitteeDetailPage() {
  const { committeeId } = useParams<{ committeeId: string }>()
  const router = useRouter()
  const { committees: MOCK_COMMITTEES, vacancies: MOCK_VACANCIES, goalsByCommittee, refetch } = useServers()

  const committee = useMemo(
    () => MOCK_COMMITTEES.find(c => c.id === committeeId),
    [MOCK_COMMITTEES, committeeId]
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

  // Edit committee modal
  const [editCommitteeOpen, setEditCommitteeOpen] = useState(false)
  const [committeeForm, setCommitteeForm] = useState<CommitteeFormState>({
    name: '', area: '', area_code: '', ideal_capacity: '',
  })
  useEffect(() => {
    if (!committee) return
    setCommitteeForm({
      name: committee.name,
      area: committee.area,
      area_code: committee.area_code,
      ideal_capacity: String(committee.ideal_capacity ?? ''),
    })
  }, [committee])
  const [committeeOverride, setCommitteeOverride] = useState<Partial<CommitteeData>>({})

  // Add server modal
  const [addServerOpen, setAddServerOpen] = useState(false)
  const [serverSearch, setServerSearch] = useState('')
  const [addedServers, setAddedServers] = useState<CommitteeServer[]>([])

  // Change position modal
  const [changePositionTarget, setChangePositionTarget] = useState<CommitteeServer | null>(null)
  const [newPosition, setNewPosition] = useState('')
  const [positionOverrides, setPositionOverrides] = useState<Record<string, string>>({})

  // Goals (local state)
  const [goals, setGoals] = useState<CommitteeGoal[]>([])
  useEffect(() => { setGoals(goalsByCommittee[committeeId] ?? []) }, [goalsByCommittee, committeeId])
  const [newGoalText, setNewGoalText] = useState('')
  const [newGoalDate, setNewGoalDate] = useState('')
  const [showGoalForm, setShowGoalForm] = useState(false)

  const committeeVacancies = useMemo(
    () => MOCK_VACANCIES.filter(v => v.committee_id === committeeId),
    [MOCK_VACANCIES, committeeId]
  )

  const allCommitteeMembers = useMemo(
    () => !committee ? [] : [...committee.members, ...addedServers].map(m => ({
      ...m,
      position: positionOverrides[m.member_id] ?? m.position,
    })),
    [committee, addedServers, positionOverrides]
  )

  const displayedMembers = useMemo(
    () => allCommitteeMembers.filter(m => {
      if (disconnected.includes(m.member_id)) return false
      const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || m.status === statusFilter
      return matchSearch && matchStatus
    }),
    [allCommitteeMembers, disconnected, search, statusFilter]
  )

  const activeCount = useMemo(
    () => allCommitteeMembers.filter(m => m.status === 'active' && !disconnected.includes(m.member_id)).length,
    [allCommitteeMembers, disconnected]
  )

  const existingMemberIds = useMemo(
    () => new Set(allCommitteeMembers.map(m => m.member_id)),
    [allCommitteeMembers]
  )

  const filteredCandidates = useMemo(() => {
    if (!serverSearch.trim()) return []
    const q = serverSearch.toLowerCase()
    return mockMembers
      .filter(m => !existingMemberIds.has(m.id) && m.is_active)
      .filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [serverSearch, existingMemberIds])

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

  async function updateCommitteeInMock() {
    const ideal = parseInt(committeeForm.ideal_capacity) || committee?.ideal_capacity
    // Reflejo inmediato en UI (el área no se persiste: cambiar de área = cambiar parent_id, fuera de alcance).
    setCommitteeOverride({
      name: committeeForm.name,
      area: committeeForm.area,
      area_code: committeeForm.area_code,
      ideal_capacity: ideal,
    })
    setEditCommitteeOpen(false)
    try {
      const res = await fetch(`/api/servers/committees/${committeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: committeeForm.name, ideal_capacity: ideal }),
      })
      if (!res.ok) throw new Error('update failed')
      await refetch()
    } catch {
      // se mantiene el override local aunque falle la persistencia
    }
  }

  function addServerToCommittee(memberId: string) {
    const member = mockMembers.find(m => m.id === memberId)
    if (!member) return
    const newServer: CommitteeServer = {
      member_id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      initials: `${member.first_name[0]}${member.last_name[0]}`,
      position: 'Colaborador',
      start_date: new Date().toISOString().split('T')[0],
      status: 'active',
    }
    setAddedServers(prev => [...prev, newServer])
    setServerSearch('')
    setAddServerOpen(false)
  }

  function updateMemberPosition() {
    if (!changePositionTarget || !newPosition) return
    setPositionOverrides(prev => ({ ...prev, [changePositionTarget.member_id]: newPosition }))
    setChangePositionTarget(null)
    setNewPosition('')
  }

  async function addGoal() {
    const description = newGoalText.trim()
    if (!description) return
    const due_date = newGoalDate || null
    setNewGoalText('')
    setNewGoalDate('')
    setShowGoalForm(false)
    try {
      const res = await fetch('/api/servers/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committee_id: committeeId, description, due_date }),
      })
      if (!res.ok) throw new Error('create goal failed')
      await refetch()
    } catch {
      // si falla, la meta no queda; el usuario puede reintentar
    }
  }

  async function toggleGoal(id: string) {
    const goal = goals.find(g => g.id === id)
    if (!goal) return
    const status = goal.status === 'completed' ? 'in_progress' : 'completed'
    setGoals(prev => prev.map(g => g.id === id ? { ...g, status } : g)) // optimista
    try {
      const res = await fetch(`/api/servers/goals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('toggle goal failed')
      await refetch()
    } catch {
      setGoals(prev => prev.map(g => g.id === id ? { ...g, status: goal.status } : g)) // revertir
    }
  }

  function handleMenuToggle(memberId: string) {
    setOpenMenu(prev => prev === memberId ? null : memberId)
  }

  function handleChangePositionOpen(member: CommitteeServer) {
    setChangePositionTarget(member)
    setNewPosition(positionOverrides[member.member_id] ?? member.position)
  }

  return (
    <div className="page">

      {/* ── Header ── */}
      <CommitteeHeader
        committee={committee}
        committeeOverride={committeeOverride}
        activeCount={activeCount}
        onBack={() => router.push('/servidores')}
        onEditClick={() => {
          setCommitteeForm({
            name: committeeOverride.name ?? committee.name,
            area: committeeOverride.area ?? committee.area,
            area_code: committeeOverride.area_code ?? committee.area_code,
            ideal_capacity: String(committeeOverride.ideal_capacity ?? committee.ideal_capacity),
          })
          setEditCommitteeOpen(true)
        }}
        onAddServerClick={() => setAddServerOpen(true)}
      />

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
        </div>

        {/* Tab: Miembros */}
        {tab === 'miembros' && (
          <MembersTab
            sortedMembers={sortedMembers}
            memberSortKey={memberSortKey}
            memberSortDir={memberSortDir}
            toggleMemberSort={toggleMemberSort}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            openMenu={openMenu}
            onMenuToggle={handleMenuToggle}
            positionOverrides={positionOverrides}
            onChangePosition={handleChangePositionOpen}
            onDisconnect={setDisconnectTarget}
            onAddServerClick={() => setAddServerOpen(true)}
          />
        )}

        {/* Tab: Vacantes */}
        {tab === 'vacantes' && (
          <VacanciesTab
            committeeId={committeeId}
            vacancies={committeeVacancies}
          />
        )}

        {/* Tab: Metas */}
        {tab === 'metas' && (
          <GoalsTab
            goals={goals}
            onToggleGoal={toggleGoal}
            showGoalForm={showGoalForm}
            onShowGoalForm={() => setShowGoalForm(true)}
            onHideGoalForm={() => setShowGoalForm(false)}
            newGoalText={newGoalText}
            onNewGoalTextChange={setNewGoalText}
            newGoalDate={newGoalDate}
            onNewGoalDateChange={setNewGoalDate}
            onAddGoal={addGoal}
          />
        )}

        {/* Disconnect modal — rendered inside card to preserve original structure */}
        {disconnectTarget && (
          <DisconnectModal
            target={disconnectTarget}
            reason={disconnectReason}
            otherReason={disconnectOtherReason}
            date={disconnectDate}
            onReasonChange={setDisconnectReason}
            onOtherReasonChange={setDisconnectOtherReason}
            onDateChange={setDisconnectDate}
            onConfirm={handleDisconnect}
            onCancel={() => setDisconnectTarget(null)}
          />
        )}

      </div>{/* end .card tabs */}

      {/* ── Modal: Editar comité ── */}
      {editCommitteeOpen && (
        <EditCommitteeModal
          form={committeeForm}
          onFormChange={setCommitteeForm}
          onSave={updateCommitteeInMock}
          onCancel={() => setEditCommitteeOpen(false)}
        />
      )}

      {/* ── Modal: Añadir servidor ── */}
      {addServerOpen && (
        <AddServerModal
          serverSearch={serverSearch}
          onServerSearchChange={setServerSearch}
          filteredCandidates={filteredCandidates}
          onAddServer={addServerToCommittee}
          onClose={() => { setAddServerOpen(false); setServerSearch('') }}
        />
      )}

      {/* ── Modal: Cambiar puesto ── */}
      {changePositionTarget && (
        <ChangePositionModal
          target={changePositionTarget}
          newPosition={newPosition}
          onPositionChange={setNewPosition}
          onConfirm={updateMemberPosition}
          onCancel={() => setChangePositionTarget(null)}
        />
      )}

    </div>
  )
}

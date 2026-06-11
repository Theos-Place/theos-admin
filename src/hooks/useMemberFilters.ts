'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import type { Member } from '@/types/member'
import { committeeInArea } from '@/lib/org'
import type { FilterCondition, ConditionGroup, AddableCondition } from '@/types/filters'

export type QuickFilter = 'todos' | 'activos' | 'donadores' | 'servidores'

// ─── filter helpers ─────────────────────────────────────────────────────────

function matchesCondition(m: Member, c: FilterCondition): boolean {
  switch (c.type) {
    case 'study': {
      const inCompleted = m.completed_studies.includes(c.study)
      const inProgress = m.current_study === c.study
      if (c.status === 'completed') return inCompleted
      if (c.status === 'in_progress') return inProgress
      return inCompleted || inProgress
    }
    case 'attendance': {
      let recs = m.attendance_history
      if (c.eventType === 'Charla')
        recs = recs.filter(r => r.type === 'Charla semanal' || r.type === 'Charla mensual')
      else if (c.eventType === 'Campamento')
        recs = recs.filter(r => r.type === 'Campamento')
      else if (c.eventType === 'Actividad Social')
        recs = recs.filter(r => r.type === 'Ayuda social' || r.type === 'Actividad servidores')
      else if (c.eventType === 'United')
        recs = recs.filter(r => r.type === 'Worship')
      if (c.sedes.length > 0) recs = recs.filter(() => c.sedes.includes(m.sede))
      if (c.camp) recs = recs.filter(r => r.name.toLowerCase().includes(c.camp.toLowerCase()))
      if (c.attendanceType === 'participant') recs = recs.filter(r => r.attendance_type === 'participante')
      else if (c.attendanceType === 'server') recs = recs.filter(r => r.attendance_type === 'servidor')
      if (c.from) recs = recs.filter(r => r.date >= c.from)
      if (c.to) recs = recs.filter(r => r.date <= c.to)
      const count = recs.length
      if (!c.qty || c.qtyOp === 'any') return count > 0
      const n = parseInt(c.qty)
      if (isNaN(n)) return count > 0
      if (c.qtyOp === 'gte') return count >= n
      if (c.qtyOp === 'lte') return count <= n
      if (c.qtyOp === 'eq') return count === n
      return count > 0
    }
    case 'service': {
      let recs = m.service_history
      if (c.area) recs = recs.filter(r => committeeInArea(r.committee, c.area))
      if (c.committee) recs = recs.filter(r => r.committee === c.committee)
      if (c.position) recs = recs.filter(r => r.position === c.position)
      if (c.status === 'active') recs = recs.filter(r => r.status === 'activo')
      else if (c.status === 'historical') recs = recs.filter(r => r.status === 'finalizado')
      if (c.from) recs = recs.filter(r => r.from >= c.from || (r.to != null && r.to >= c.from))
      if (c.to) recs = recs.filter(r => r.from <= c.to)
      return recs.length > 0
    }
    case 'form': {
      let recs = m.form_responses.filter(r => r.formId === c.formId)
      if (c.status === 'not_filled') return recs.length === 0
      if (c.from) recs = recs.filter(r => r.submittedAt >= c.from)
      if (c.to) recs = recs.filter(r => r.submittedAt <= c.to)
      if (c.field && c.fieldVal) {
        recs = recs.filter(r => {
          const val = r.answers[c.field]
          if (!val) return false
          const pattern = '^' + c.fieldVal.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
          return new RegExp(pattern, 'i').test(val)
        })
      }
      return recs.length > 0
    }
    case 'donor': return c.value === 'yes' ? m.is_donor : !m.is_donor
    case 'age': {
      if (c.min && m.age < parseInt(c.min)) return false
      if (c.max && m.age > parseInt(c.max)) return false
      return true
    }
    case 'status': return c.value === 'active' ? m.is_active : !m.is_active
    case 'leader': return c.value === 'yes' ? m.es_dirigente : !m.es_dirigente
  }
}

type Unit =
  | { kind: 'condition'; id: number }
  | { kind: 'group'; id: number; members: number[]; op: 'AND' | 'OR' }

export function buildUnits(conditions: FilterCondition[], groups: ConditionGroup[]): Unit[] {
  const groupedIds = new Set(groups.flatMap(g => g.members))
  const addedGroups = new Set<number>()
  const units: Unit[] = []
  for (const cond of conditions) {
    if (groupedIds.has(cond.id)) {
      const grp = groups.find(g => g.members.includes(cond.id))
      if (grp && !addedGroups.has(grp.id)) {
        addedGroups.add(grp.id)
        units.push({ kind: 'group', id: grp.id, members: grp.members, op: grp.op })
      }
    } else {
      units.push({ kind: 'condition', id: cond.id })
    }
  }
  return units
}

function applyFilters(
  members: Member[],
  conditions: FilterCondition[],
  groups: ConditionGroup[],
  topLevelOps: Record<string, 'AND' | 'OR'>,
): Member[] {
  const units = buildUnits(conditions, groups)
  if (units.length === 0) return members

  const condMap = new Map(conditions.map(c => [c.id, c]))

  function testUnit(m: Member, unit: Unit): boolean {
    if (unit.kind === 'condition') {
      const c = condMap.get(unit.id)
      return c ? matchesCondition(m, c) : true
    }
    const grpConds = unit.members.map(id => condMap.get(id)).filter(Boolean) as FilterCondition[]
    if (unit.op === 'AND') return grpConds.every(c => matchesCondition(m, c))
    return grpConds.some(c => matchesCondition(m, c))
  }

  let result = members
  for (let i = 0; i < units.length; i++) {
    const unit = units[i]
    const key = unit.kind === 'condition' ? `c${unit.id}` : `g${unit.id}`
    const op = i === 0 ? 'AND' : (topLevelOps[key] ?? 'AND')
    if (op === 'AND') {
      result = result.filter(m => testUnit(m, unit))
    } else {
      const passing = members.filter(m => testUnit(m, unit))
      const inResult = new Set(result.map(m => m.id))
      result = [...result, ...passing.filter(m => !inResult.has(m.id))]
    }
  }

  return result
}

// ─── hook ───────────────────────────────────────────────────────────────────

export function useMemberFilters(members: Member[]) {
  const [conditions, setConditions] = useState<FilterCondition[]>([])
  const [groups, setGroups] = useState<ConditionGroup[]>([])
  const [topLevelOps, setTopLevelOps] = useState<Record<string, 'AND' | 'OR'>>({})
  const [groupMode, setGroupMode] = useState(false)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [newGroupOp, setNewGroupOp] = useState<'AND' | 'OR'>('AND')
  const nextId = useRef(1)

  const addCondition = useCallback((partial: AddableCondition) => {
    const id = nextId.current++
    const cond = { ...partial, id } as FilterCondition
    setConditions(prev => [...prev, cond])
    setTopLevelOps(prev => ({ ...prev, [`c${id}`]: 'AND' }))
  }, [])

  const removeCondition = useCallback((id: number) => {
    setConditions(prev => prev.filter(c => c.id !== id))
    setGroups(prev => {
      const updated = prev.map(g => ({ ...g, members: g.members.filter(m => m !== id) }))
      return updated.filter(g => g.members.length >= 2)
    })
    setTopLevelOps(prev => {
      const next = { ...prev }
      delete next[`c${id}`]
      return next
    })
  }, [])

  const removeConditionsByGroup = useCallback((groupId: number) => {
    setGroups(prevGroups => {
      const grp = prevGroups.find(g => g.id === groupId)
      if (grp) {
        const memberIds = grp.members
        setConditions(prev => prev.filter(c => !memberIds.includes(c.id)))
        setTopLevelOps(prev => {
          const next = { ...prev }
          delete next[`g${groupId}`]
          memberIds.forEach(id => delete next[`c${id}`])
          return next
        })
      }
      return prevGroups.filter(g => g.id !== groupId)
    })
  }, [])

  const removeGroup = useCallback((groupId: number) => {
    setGroups(prevGroups => {
      const grp = prevGroups.find(g => g.id === groupId)
      if (grp) {
        setTopLevelOps(prevOps => {
          const next = { ...prevOps }
          const incoming = next[`g${groupId}`] ?? 'AND'
          delete next[`g${groupId}`]
          const [first, ...rest] = grp.members
          if (first !== undefined) next[`c${first}`] = incoming
          rest.forEach(id => { if (!(`c${id}` in next)) next[`c${id}`] = 'AND' })
          return next
        })
      }
      return prevGroups.filter(g => g.id !== groupId)
    })
  }, [])

  const toggleGroupMode = useCallback(() => {
    setGroupMode(m => !m)
    setPicked(new Set())
  }, [])

  const togglePick = useCallback((id: number) => {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const confirmGroup = useCallback(() => {
    if (picked.size < 2) return
    const id = nextId.current++
    const members = Array.from(picked)
    const grp: ConditionGroup = { id, members, op: newGroupOp }
    setGroups(prev => [...prev, grp])
    setTopLevelOps(prev => {
      const next = { ...prev }
      const firstOp = next[`c${members[0]}`] ?? 'AND'
      members.forEach(m => delete next[`c${m}`])
      next[`g${id}`] = firstOp
      return next
    })
    setPicked(new Set())
    setGroupMode(false)
  }, [picked, newGroupOp])

  const cancelGroup = useCallback(() => {
    setPicked(new Set())
    setGroupMode(false)
  }, [])

  const toggleOperator = useCallback((unitKey: string) => {
    setTopLevelOps(prev => ({ ...prev, [unitKey]: prev[unitKey] === 'AND' ? 'OR' : 'AND' }))
  }, [])

  const toggleGroupOp = useCallback((groupId: number) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, op: g.op === 'AND' ? 'OR' : 'AND' } : g))
  }, [])

  const clearAll = useCallback(() => {
    setConditions([])
    setGroups([])
    setTopLevelOps({})
    setGroupMode(false)
    setPicked(new Set())
  }, [])

  const filteredMembers = useMemo(
    () => applyFilters(members, conditions, groups, topLevelOps),
    [members, conditions, groups, topLevelOps],
  )

  return {
    conditions,
    groups,
    topLevelOps,
    groupMode,
    picked,
    newGroupOp,
    addCondition,
    removeCondition,
    removeConditionsByGroup,
    toggleGroupMode,
    togglePick,
    setNewGroupOp,
    confirmGroup,
    cancelGroup,
    removeGroup,
    toggleOperator,
    toggleGroupOp,
    clearAll,
    filteredMembers,
  }
}

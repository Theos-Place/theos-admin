'use client'

import { Fragment } from 'react'
import { X, Parentheses } from 'lucide-react'
import { cn } from '@/lib/utils'
import { conditionLabel } from '@/lib/condition-labels'
import type { FilterCondition, ConditionGroup } from '@/types/filters'

type Props = {
  conditions: FilterCondition[]
  groups: ConditionGroup[]
  topLevelOps: Record<string, 'AND' | 'OR'>
  groupMode: boolean
  picked: Set<number>
  newGroupOp: 'AND' | 'OR'
  removeCondition: (id: number) => void
  removeConditionsByGroup: (groupId: number) => void
  removeGroup: (groupId: number) => void
  toggleGroupMode: () => void
  togglePick: (id: number) => void
  setNewGroupOp: (op: 'AND' | 'OR') => void
  confirmGroup: () => void
  cancelGroup: () => void
  toggleOperator: (unitKey: string) => void
  toggleGroupOp: (groupId: number) => void
}

type DisplayUnit =
  | { kind: 'condition'; id: number }
  | { kind: 'group'; id: number; members: number[]; op: 'AND' | 'OR' }

function buildDisplayUnits(conditions: FilterCondition[], groups: ConditionGroup[]): DisplayUnit[] {
  const groupedIds = new Set(groups.flatMap(g => g.members))
  const addedGroups = new Set<number>()
  const units: DisplayUnit[] = []
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

function OpToggle({ op, onToggle }: { op: 'AND' | 'OR'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide transition-colors',
        op === 'AND'
          ? 'bg-navy text-white hover:bg-navy/80'
          : 'bg-coral text-white hover:bg-coral/80',
        'font-display',
      )}
      title={`Cambiar a ${op === 'AND' ? 'OR' : 'AND'}`}
      aria-label={`Operador ${op}: cambiar a ${op === 'AND' ? 'OR' : 'AND'}`}
    >
      {op}
    </button>
  )
}

function ConditionPill({
  condition, groupMode, isPicked, onToggle, onRemove,
}: {
  condition: FilterCondition
  groupMode: boolean
  isPicked: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <span
      onClick={groupMode ? onToggle : undefined}
      className={cn(
        'flex items-center gap-1 rounded-full pl-2.5 pr-1.5 py-1 text-xs transition-all',
        groupMode
          ? cn(
              'cursor-pointer select-none',
              isPicked
                ? 'bg-coral/15 ring-1 ring-coral text-coral'
                : 'bg-surface-low text-navy-light/70 hover:bg-navy/8 hover:text-navy',
            )
          : 'bg-navy/8 text-navy-light',
        'font-body',
      )}
    >
      <span>{conditionLabel(condition)}</span>
      {!groupMode && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="rounded-full p-0.5 text-navy-light/70 hover:text-coral transition-colors"
          aria-label="Quitar"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  )
}

function GroupBracket({
  group, conditions, onToggleOp, onUngroup, onRemove,
}: {
  group: ConditionGroup
  conditions: FilterCondition[]
  onToggleOp: () => void
  onUngroup: () => void
  onRemove: () => void
}) {
  return (
    <span
      className="flex items-center gap-1 rounded-xl px-2 py-1 text-xs border-[1.5px] border-dashed border-[var(--outline-variant)] font-body"
    >
      <span className="text-[10px] text-navy-light/70 mr-0.5">(</span>
      {conditions.map((c, i) => (
        <Fragment key={c.id}>
          {i > 0 && (
            <button
              onClick={onToggleOp}
              className={cn(
                'rounded px-1 py-0.5 text-[8px] font-semibold tracking-wide transition-colors',
                group.op === 'AND'
                  ? 'bg-navy/10 text-navy hover:bg-navy/20'
                  : 'bg-coral/10 text-coral hover:bg-coral/20',
                'font-display',
              )}
            >
              {group.op}
            </button>
          )}
          <span className="text-navy-light/70">{conditionLabel(c)}</span>
        </Fragment>
      ))}
      <span className="text-[10px] text-navy-light/70 ml-0.5">)</span>
      <button
        onClick={onUngroup}
        className="ml-0.5 rounded px-1 py-0.5 text-[10px] text-navy-light/70 hover:text-navy-light transition-colors"
        title="Disolver grupo"
        aria-label="Disolver grupo"
      >
        [ ]
      </button>
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 text-navy-light/70 hover:text-coral transition-colors"
        aria-label="Eliminar grupo"
      >
        <X size={10} strokeWidth={2.5} />
      </button>
    </span>
  )
}

export function QueryBar({
  conditions, groups, topLevelOps, groupMode, picked, newGroupOp,
  removeCondition, removeConditionsByGroup, removeGroup,
  toggleGroupMode, togglePick, setNewGroupOp, confirmGroup, cancelGroup,
  toggleOperator, toggleGroupOp,
}: Props) {
  if (conditions.length === 0) return null

  const units = buildDisplayUnits(conditions, groups)
  const condMap = new Map(conditions.map(c => [c.id, c]))
  const groupMap = new Map(groups.map(g => [g.id, g]))

  const standaloneCount = conditions.filter(
    c => !groups.some(g => g.members.includes(c.id))
  ).length

  return (
    <div className="space-y-2">
      {/* Lista vertical de filtros activos (se apilan hacia abajo, no se enciman) */}
      <div className="flex flex-col items-start gap-1.5">
        {units.map((unit, i) => {
          const key = unit.kind === 'condition' ? `c${unit.id}` : `g${unit.id}`
          const op = topLevelOps[key] ?? 'AND'

          return (
            <Fragment key={key}>
              {i > 0 && (
                <OpToggle op={op} onToggle={() => toggleOperator(key)} />
              )}

              {unit.kind === 'condition' ? (
                <ConditionPill
                  condition={condMap.get(unit.id)!}
                  groupMode={groupMode}
                  isPicked={picked.has(unit.id)}
                  onToggle={() => togglePick(unit.id)}
                  onRemove={() => removeCondition(unit.id)}
                />
              ) : (
                <GroupBracket
                  group={groupMap.get(unit.id)!}
                  conditions={unit.members.map(id => condMap.get(id)!).filter(Boolean)}
                  onToggleOp={() => toggleGroupOp(unit.id)}
                  onUngroup={() => removeGroup(unit.id)}
                  onRemove={() => removeConditionsByGroup(unit.id)}
                />
              )}
            </Fragment>
          )
        })}

        {!groupMode && standaloneCount >= 2 && (
          <button
            onClick={toggleGroupMode}
            className="flex items-center gap-1 rounded-full bg-surface-low px-3 py-1 text-xs text-navy-light/70 hover:bg-navy/8 hover:text-navy transition-colors font-body"
          >
            <Parentheses size={12} strokeWidth={1.75} />
            Agrupar
          </button>
        )}
      </div>

      {/* Group mode panel */}
      {groupMode && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 text-sm bg-surface-low border border-[var(--outline-variant)]"
        >
          <span className="text-xs text-navy-light/70 font-body">
            Seleccioná 2 o más filtros para agrupar
          </span>

          <div className="flex items-center gap-1.5 text-xs font-body">
            <span className="text-navy-light/70">Operador:</span>
            <span className="flex overflow-hidden rounded border border-[var(--outline-variant)]">
              <button
                onClick={() => setNewGroupOp('AND')}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors',
                  newGroupOp === 'AND' ? 'bg-navy text-white' : 'text-navy-light/70 hover:bg-surface-card',
                  'font-display',
                )}
              >
                AND
              </button>
              <button
                onClick={() => setNewGroupOp('OR')}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors',
                  newGroupOp === 'OR' ? 'bg-coral text-white' : 'text-navy-light/70 hover:bg-surface-card',
                  'font-display',
                )}
              >
                OR
              </button>
            </span>
          </div>

          <button
            onClick={confirmGroup}
            disabled={picked.size < 2}
            className="rounded-lg bg-navy px-3 py-1 text-xs text-white transition-all hover:bg-navy/80 disabled:opacity-40 disabled:cursor-not-allowed font-body"
          >
            Crear grupo ({picked.size})
          </button>

          <button
            onClick={cancelGroup}
            className="text-xs text-navy-light/70 hover:text-coral transition-colors font-body"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

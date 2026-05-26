'use client'

import { Plus, Check } from 'lucide-react'
import { type CommitteeGoal } from '@/data/mock-servers'
import { cn } from '@/lib/utils'

type Props = {
  goals: CommitteeGoal[]
  onToggleGoal: (id: string) => void
  showGoalForm: boolean
  onShowGoalForm: () => void
  onHideGoalForm: () => void
  newGoalText: string
  onNewGoalTextChange: (value: string) => void
  newGoalDate: string
  onNewGoalDateChange: (value: string) => void
  onAddGoal: () => void
}

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

export function GoalsTab({
  goals,
  onToggleGoal,
  showGoalForm,
  onShowGoalForm,
  onHideGoalForm,
  newGoalText,
  onNewGoalTextChange,
  newGoalDate,
  onNewGoalDateChange,
  onAddGoal,
}: Props) {
  return (
    <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {goals.map(g => (
        <div
          key={g.id}
          className="flex items-start gap-3 rounded-2xl px-5 py-4"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
        >
          <button
            onClick={() => onToggleGoal(g.id)}
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
            onChange={e => onNewGoalTextChange(e.target.value)}
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
              onChange={e => onNewGoalDateChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAddGoal}
              className="rounded-full bg-navy px-4 py-1.5 text-[12px] text-white hover:bg-navy/80 transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Agregar meta
            </button>
            <button
              onClick={onHideGoalForm}
              className="rounded-full border px-4 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onShowGoalForm}
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
  )
}

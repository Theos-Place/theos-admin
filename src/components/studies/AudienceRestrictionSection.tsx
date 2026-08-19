'use client'

// GRU-2 · "Restringir este grupo a… (opcional)".
//
// Es el MISMO constructor de condiciones del padrón (AdvancedFilters), acotado a
// los tipos que describen una audiencia. Mientras se arma, muestra cuánta gente
// del padrón cumple: una condición demasiado estrecha se ve al instante y no
// cuando nadie se matriculó.
//
// El componente no guarda nada: le devuelve al form la restricción normalizada
// (o null) y el form la manda con el resto del grupo.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronUp, Users, Loader2 } from 'lucide-react'
import { AdvancedFilters } from '@/components/members/AdvancedFilters'
import { cn } from '@/lib/utils'
import type { FilterCondition, AddableCondition } from '@/types/filters'
import {
  ALLOWED_RESTRICTION_TYPES, restrictionSummary, hasRestriction,
  type GroupRestriction,
} from '@/lib/studies/group-restrictions'

type Props = {
  value: GroupRestriction | null
  onChange: (r: GroupRestriction | null) => void
  /** Arranca abierta (al editar un grupo que YA tiene restricción). */
  defaultOpen?: boolean
}

export function AudienceRestrictionSection({ value, onChange, defaultOpen }: Props) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [count, setCount] = useState<number | null>(null)
  const [counting, setCounting] = useState(false)

  const conditions: FilterCondition[] = useMemo(() => value?.conditions ?? [], [value])

  const addCondition = useCallback((c: AddableCondition) => {
    // El id incremental es el que usan los grupos AND/OR del constructor.
    const nextId = conditions.reduce((max, x) => Math.max(max, x.id), 0) + 1
    const nuevas = [...conditions, { ...c, id: nextId } as FilterCondition]
    onChange({ conditions: nuevas, groups: value?.groups ?? [], ops: value?.ops ?? {} })
  }, [conditions, onChange, value])

  const removeCondition = useCallback((id: number) => {
    const nuevas = conditions.filter(c => c.id !== id)
    if (nuevas.length === 0) { onChange(null); return }   // vacío = grupo abierto
    onChange({
      conditions: nuevas,
      groups: (value?.groups ?? []).map(g => ({ ...g, members: g.members.filter(m => m !== id) })),
      ops: value?.ops ?? {},
    })
  }, [conditions, onChange, value])

  // Conteo del padrón. Se recalcula al cambiar la restricción, con un respiro
  // para no disparar una consulta por cada clic.
  useEffect(() => {
    if (!hasRestriction(value)) return
    let vivo = true
    const t = setTimeout(() => {
      setCounting(true)
      fetch('/api/studies/groups/restriction-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restriction: value }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (vivo) setCount(typeof d?.count === 'number' ? d.count : null) })
        .catch(() => { if (vivo) setCount(null) })
        .finally(() => { if (vivo) setCounting(false) })
    }, 400)
    return () => { vivo = false; clearTimeout(t) }
  }, [value])

  const resumen = restrictionSummary(value)

  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-low transition-colors"
      >
        <span>
          <span className="text-sm text-navy font-display">Restringir este grupo a… (opcional)</span>
          <span className="block text-[13px] text-navy-light/80 font-body mt-0.5">
            {resumen
              ? `Solo para: ${resumen}`
              : 'Sin restricción: se le ofrece a cualquiera que califique para esta etapa.'}
          </span>
        </span>
        {open ? <ChevronUp size={18} className="text-navy-light/80 shrink-0" /> : <ChevronDown size={18} className="text-navy-light/80 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-[13px] text-navy-light/80 font-body">
            Esto <strong>se suma</strong> a los requisitos de la etapa (donador, servidor,
            asistencia, estudios previos), no los reemplaza. Quien no cumpla la restricción
            no verá este grupo entre sus opciones.
          </p>

          <AdvancedFilters
            conditions={conditions}
            addCondition={addCondition}
            removeCondition={removeCondition}
            allowedTypes={ALLOWED_RESTRICTION_TYPES}
          />

          {hasRestriction(value) && (
            <div className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-body',
              count === 0 ? 'bg-coral-soft/20 text-coral-deep' : 'bg-surface-low text-navy-light',
            )}>
              {counting
                ? <><Loader2 size={14} className="animate-spin shrink-0" /> Calculando a cuánta gente alcanza…</>
                : count === null
                  ? <><Users size={14} className="shrink-0" /> No se pudo calcular el alcance.</>
                  : count === 0
                    ? <><Users size={14} className="shrink-0" /> <span><strong>Nadie</strong> del padrón cumple esta restricción — así, el grupo no se le ofrecerá a nadie.</span></>
                    : <><Users size={14} className="shrink-0" /> <span><strong>{count.toLocaleString('es-CR')}</strong> {count === 1 ? 'persona cumple' : 'personas cumplen'} esta restricción.</span></>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

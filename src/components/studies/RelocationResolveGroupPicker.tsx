'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { sedeLabel } from '@/lib/sedes'
import { relocationGroupScore, requestZones } from '@/lib/studies/request-prefs'
import { useStudies } from '@/hooks/useStudies'
import type { StudyRequest } from '@/types/study'

type GroupOption = {
  id: string
  name: string
  status: string
  zone: string | null
  schedule_days: string[] | null
  schedule_time: string | null
  max_students: number | null
  enrollment_counts?: { enrolled: number; pending: number; withdrawn: number }
  plan: { code: string | null } | null
  leader: { first_name: string; last_name: string } | null
}

const DAY_LABELS: Record<string, string> = {
  L: 'Lun', M: 'Mar', X: 'Mié', J: 'Jue', V: 'Vie', S: 'Sáb', D: 'Dom',
}

function formatDays(days: string[] | null): string {
  return (days ?? []).map(d => DAY_LABELS[d] ?? d).join(', ')
}

/**
 * Selector de grupo destino al resolver un tiquete de reubicación. Ofrece los
 * grupos abiertos (en_matricula/en_curso) del estudio que la persona necesita
 * (needed_study_code) Y los de su nivel anterior (el prerequisito de la
 * cadena): a veces la solución correcta es reubicar un nivel atrás — p. ej.
 * pidió N3 pero le corresponde N2 (decisión 2026-08-20). Preselecciona el
 * grupo que el miembro había pedido (existing_group_id) si sigue disponible.
 * `onChange` alimenta el payload del PATCH de resolución vía RequestBoard
 * (null = inválido, bloquea el submit).
 */
export function RelocationResolveGroupPicker({
  request, onChange,
}: {
  request: StudyRequest
  onChange: (payload: Record<string, unknown> | null) => void
}) {
  const { studyTypes } = useStudies('plans')
  const [allGroups, setAllGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('')

  // El nivel anterior en la cadena del estudio pedido (N3 → N2, DIS1 → SCJ…).
  const prevCode = useMemo(
    () => studyTypes.find(s => s.code === request.needed_study_code)?.prerequisite ?? null,
    [studyTypes, request.needed_study_code],
  )

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('/api/studies/groups')
      .then(r => (r.ok ? r.json() : []))
      .then((all: GroupOption[]) => {
        if (!alive) return
        setAllGroups((Array.isArray(all) ? all : []).filter(g =>
          g.status === 'en_matricula' || g.status === 'en_curso',
        ))
      })
      .catch(() => { if (alive) setAllGroups([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [request.id])

  // REU-1: los candidatos que calzan con las zonas/días pedidos van primero.
  const sortByPrefs = useMemo(() => {
    const prefs = { zones: requestZones(request), days: request.proposed_days ?? [] }
    return (list: GroupOption[]) => [...list].sort((a, b) =>
      relocationGroupScore({ zoneName: b.zone ? sedeLabel(b.zone) : null, schedule_days: b.schedule_days }, prefs)
      - relocationGroupScore({ zoneName: a.zone ? sedeLabel(a.zone) : null, schedule_days: a.schedule_days }, prefs))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id])

  const neededGroups = useMemo(
    () => sortByPrefs(allGroups.filter(g => !request.needed_study_code || g.plan?.code === request.needed_study_code)),
    [allGroups, sortByPrefs, request.needed_study_code],
  )
  const prevGroups = useMemo(
    () => (prevCode ? sortByPrefs(allGroups.filter(g => g.plan?.code === prevCode)) : []),
    [allGroups, sortByPrefs, prevCode],
  )

  // Preselecciona el grupo que la persona había pedido, si sigue disponible.
  useEffect(() => {
    if (loading) return
    const available = [...neededGroups, ...prevGroups]
    const preferred = request.existing_group_id && available.some(g => g.id === request.existing_group_id)
      ? request.existing_group_id
      : ''
    setSelected(preferred)
    onChange(preferred ? { target_group_id: preferred } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, request.id])

  function handleSelect(id: string) {
    setSelected(id)
    onChange(id ? { target_group_id: id } : null)
  }

  const optionLabel = (g: GroupOption) => {
    const enrolled = g.enrollment_counts?.enrolled ?? 0
    const spots = g.max_students != null ? `${enrolled}/${g.max_students}` : `${enrolled}`
    const leader = g.leader ? `${g.leader.first_name} ${g.leader.last_name}`.trim() : 'Sin dirigente'
    return `${g.name} — ${g.zone ? sedeLabel(g.zone) : 'Sin zona'} · ${formatDays(g.schedule_days)} ${g.schedule_time ?? ''} · ${leader} · ${spots}`
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="relocation-target-group" className="block text-[13px] font-medium text-navy-light/80 font-body">
        Grupo destino <span className="text-coral">*</span>
      </label>
      {loading ? (
        <p className="text-[13px] text-navy-light/80 font-body inline-flex items-center gap-1.5">
          <Loader2 size={13} className="animate-spin" /> Cargando grupos disponibles…
        </p>
      ) : neededGroups.length === 0 && prevGroups.length === 0 ? (
        <p className="text-[13px] text-coral font-body">
          No hay grupos abiertos de {request.needed_study_code ?? 'ese estudio'}
          {prevCode ? ` ni de ${prevCode}` : ''} en este momento.
        </p>
      ) : (
        <select
          id="relocation-target-group"
          value={selected}
          onChange={e => handleSelect(e.target.value)}
          className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
        >
          <option value="">Elegí el grupo…</option>
          <optgroup label={`${request.needed_study_code ?? 'Estudio pedido'} (lo que pidió)`}>
            {neededGroups.map(g => (
              <option key={g.id} value={g.id}>{optionLabel(g)}</option>
            ))}
          </optgroup>
          {prevGroups.length > 0 && (
            <optgroup label={`${prevCode} (nivel anterior)`}>
              {prevGroups.map(g => (
                <option key={g.id} value={g.id}>{optionLabel(g)}</option>
              ))}
            </optgroup>
          )}
        </select>
      )}
      {request.wants_folleto && (
        <p className="text-[13px] text-navy-light/80 font-body">
          Marcó &quot;Ocupo folleto&quot;: la matrícula va a quedar pendiente de pago (costo del folleto) y se va a generar el tiquete en la cola de folletos.
        </p>
      )}
    </div>
  )
}

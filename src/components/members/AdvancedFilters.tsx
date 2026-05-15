'use client'

import { cn } from '@/lib/utils'
import { STUDY_CATALOG, STUDY_STAGES } from '@/data/study-catalog'
import type { useMemberFilters, TriState } from '@/hooks/useMemberFilters'

type Props = ReturnType<typeof useMemberFilters>

const TIPOS_EVENTO = ['Charla', 'Campamento', 'Actividad Social', 'United']
const SEDES = ['Meridiano', 'Heredia', 'Cartago', 'Rohrmoser', 'San José']
const COMITES = ['Bienvenida', 'Estudios Bíblicos', 'Sonido', 'Comunicaciones', 'Finanzas']
const ESTADOS_DIRIGENTE = [
  { value: 'activo',      label: 'Activo' },
  { value: 'en_descanso', label: 'En descanso' },
  { value: 'disponible',  label: 'Disponible' },
]

const STAGE_STYLE: Record<string, { text: string; codeFg: string }> = {
  navy:  { text: 'text-navy',      codeFg: 'text-navy/60' },
  teal:  { text: 'text-teal-deep', codeFg: 'text-teal-deep/70' },
  coral: { text: 'text-coral',     codeFg: 'text-coral/70' },
}

// ─── Shared primitives ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[10px] tracking-widest uppercase text-navy-light/40"
      style={{ fontFamily: 'var(--font-display)' }}>
      {children}
    </p>
  )
}

function CheckboxGroup({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      {options.map(({ value, label }) => (
        <label key={value} className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={() => onToggle(value)}
            className="accent-coral h-3.5 w-3.5 shrink-0 cursor-pointer"
          />
          <span className="text-sm text-navy-light/70 group-hover:text-navy transition-colors select-none"
            style={{ fontFamily: 'var(--font-body)' }}>
            {label}
          </span>
        </label>
      ))}
    </div>
  )
}

function TriToggle({ value, onChange }: { value: TriState; onChange: (v: TriState) => void }) {
  const opts: { v: TriState; label: string }[] = [
    { v: 'si', label: 'Sí' }, { v: 'no', label: 'No' }, { v: 'cualquiera', label: 'Cualquiera' },
  ]
  return (
    <div className="flex overflow-hidden rounded-xl text-xs" style={{ border: '1px solid var(--outline-variant)' }}>
      {opts.map(({ v, label }) => (
        <button key={v} onClick={() => onChange(v)}
          className={cn('flex-1 py-1.5 transition-colors', v === value ? 'bg-navy text-white' : 'text-navy-light/60 hover:bg-surface-low')}
          style={{ fontFamily: 'var(--font-body)' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

function ProfileToggle({ value, onChange }: {
  value: 'activo' | 'inactivo' | 'todos'
  onChange: (v: 'activo' | 'inactivo' | 'todos') => void
}) {
  const opts: { v: 'activo' | 'inactivo' | 'todos'; label: string }[] = [
    { v: 'activo', label: 'Activo' }, { v: 'inactivo', label: 'Inactivo' }, { v: 'todos', label: 'Todos' },
  ]
  return (
    <div className="flex overflow-hidden rounded-xl text-xs" style={{ border: '1px solid var(--outline-variant)' }}>
      {opts.map(({ v, label }) => (
        <button key={v} onClick={() => onChange(v)}
          className={cn('flex-1 py-1.5 transition-colors', v === value ? 'bg-navy text-white' : 'text-navy-light/60 hover:bg-surface-low')}
          style={{ fontFamily: 'var(--font-body)' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Grouped study checkboxes ───────────────────────────────────────────────

function StudyGroupCheckboxes({
  sectionLabel,
  selected,
  onToggleSingle,
  onToggleStage,
}: {
  sectionLabel: string
  selected: string[]
  onToggleSingle: (code: string) => void
  onToggleStage: (stage: string) => void
}) {
  return (
    <div>
      <SectionLabel>{sectionLabel}</SectionLabel>
      <div className="space-y-3">
        {(Object.entries(STUDY_STAGES) as [string, { label: string; color: string }][]).map(
          ([stageKey, stage]) => {
            const studiesInStage = STUDY_CATALOG.filter(s => s.stage === stageKey)
            const selectedCount  = studiesInStage.filter(s => selected.includes(s.code)).length
            const allSelected    = selectedCount === studiesInStage.length
            const someSelected   = selectedCount > 0 && !allSelected
            const style          = STAGE_STYLE[stage.color] ?? STAGE_STYLE.navy

            return (
              <div key={stageKey}>
                {/* Stage header with "select all" */}
                <label className="flex items-center gap-2 mb-1.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    ref={el => { if (el) el.indeterminate = someSelected }}
                    checked={allSelected}
                    onChange={() => onToggleStage(stageKey)}
                    className="accent-coral h-3.5 w-3.5 shrink-0 cursor-pointer"
                  />
                  <span className={cn('text-[10px] font-medium tracking-wider uppercase select-none', style.text)}
                    style={{ fontFamily: 'var(--font-display)' }}>
                    {stage.label}
                  </span>
                  {selectedCount > 0 && (
                    <span className="ml-auto rounded-full bg-coral/10 px-1.5 py-0.5 text-[9px] text-coral tabular-nums">
                      {selectedCount}/{studiesInStage.length}
                    </span>
                  )}
                </label>

                {/* Individual studies */}
                <div className="pl-5 space-y-1">
                  {studiesInStage.map(study => (
                    <label key={study.code} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selected.includes(study.code)}
                        onChange={() => onToggleSingle(study.code)}
                        className="accent-coral h-3 w-3 shrink-0 cursor-pointer"
                      />
                      <span className="text-xs text-navy-light/60 group-hover:text-navy transition-colors select-none"
                        style={{ fontFamily: 'var(--font-mono)' }}>
                        <span className={cn('font-medium', style.codeFg)}>{study.code}</span>
                        <span className="text-navy-light/40"> — </span>
                        {study.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}

// ─── Panel ─────────────────────────────────────────────────────────────────

export function AdvancedFilters(props: Props) {
  if (!props.advancedOpen) return null

  return (
    <div className="rounded-2xl p-5"
      style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
      <div className="grid gap-x-8 gap-y-6"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>

        {/* ESTUDIOS — Completado */}
        <StudyGroupCheckboxes
          sectionLabel="Completado"
          selected={props.completedStudies}
          onToggleSingle={props.toggleCompletedStudy}
          onToggleStage={props.toggleStageCompleted}
        />

        {/* ESTUDIOS — En progreso + Último */}
        <div className="space-y-4">
          <StudyGroupCheckboxes
            sectionLabel="En progreso"
            selected={props.inProgressStudies}
            onToggleSingle={props.toggleInProgressStudy}
            onToggleStage={props.toggleStageInProgress}
          />
          <div>
            <SectionLabel>Último estudio completado</SectionLabel>
            <select
              value={props.ultimoEstudio}
              onChange={e => props.setUltimoEstudio(e.target.value)}
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <option value="">Cualquiera</option>
              {(Object.entries(STUDY_STAGES) as [string, { label: string; color: string }][]).map(
                ([stageKey, stage]) => (
                  <optgroup key={stageKey} label={stage.label}>
                    {STUDY_CATALOG.filter(s => s.stage === stageKey).map(s => (
                      <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                    ))}
                  </optgroup>
                )
              )}
            </select>
          </div>
        </div>

        {/* EVENTOS */}
        <div className="space-y-4">
          <div>
            <SectionLabel>Tipo de evento</SectionLabel>
            <CheckboxGroup
              options={TIPOS_EVENTO.map(t => ({ value: t, label: t }))}
              selected={props.tiposEvento}
              onToggle={props.toggleTipoEvento}
            />
          </div>
          <div>
            <SectionLabel>Rango de fechas</SectionLabel>
            <div className="flex gap-2">
              <input type="date" value={props.fechaDesde} onChange={e => props.setFechaDesde(e.target.value)}
                className="flex-1 min-w-0 rounded-xl bg-surface-low px-2 py-1.5 text-xs text-navy outline-none focus:ring-1 focus:ring-coral/30"
                style={{ fontFamily: 'var(--font-body)' }} />
              <input type="date" value={props.fechaHasta} onChange={e => props.setFechaHasta(e.target.value)}
                className="flex-1 min-w-0 rounded-xl bg-surface-low px-2 py-1.5 text-xs text-navy outline-none focus:ring-1 focus:ring-coral/30"
                style={{ fontFamily: 'var(--font-body)' }} />
            </div>
          </div>
        </div>

        {/* SEDE */}
        <div>
          <SectionLabel>Sede</SectionLabel>
          <CheckboxGroup
            options={SEDES.map(s => ({ value: s, label: s }))}
            selected={props.sedes}
            onToggle={props.toggleSede}
          />
        </div>

        {/* VOLUNTARIOS */}
        <div className="space-y-4">
          <div>
            <SectionLabel>Comité</SectionLabel>
            <CheckboxGroup
              options={COMITES.map(c => ({ value: c, label: c }))}
              selected={props.comites}
              onToggle={props.toggleComite}
            />
          </div>
          <div>
            <SectionLabel>Estado de servicio</SectionLabel>
            <TriToggle value={props.estadoServicio} onChange={props.setEstadoServicio} />
          </div>
        </div>

        {/* DIRIGENTES */}
        <div className="space-y-4">
          <div>
            <SectionLabel>Es dirigente</SectionLabel>
            <TriToggle value={props.esDirigente} onChange={props.setEsDirigente} />
          </div>
          <div>
            <SectionLabel>Estado del dirigente</SectionLabel>
            <CheckboxGroup
              options={ESTADOS_DIRIGENTE}
              selected={props.estadosDirigente}
              onToggle={props.toggleEstadoDirigente}
            />
          </div>
        </div>

        {/* DATOS PERSONALES */}
        <div className="space-y-4">
          <div>
            <SectionLabel>Rango de edad</SectionLabel>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} value={props.edadDesde}
                onChange={e => props.setEdadDesde(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Desde"
                className="w-full rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy placeholder-navy-light/40 outline-none focus:ring-1 focus:ring-coral/30"
                style={{ fontFamily: 'var(--font-body)' }} />
              <span className="text-navy-light/40 shrink-0">–</span>
              <input type="number" min={0} max={100} value={props.edadHasta}
                onChange={e => props.setEdadHasta(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Hasta"
                className="w-full rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy placeholder-navy-light/40 outline-none focus:ring-1 focus:ring-coral/30"
                style={{ fontFamily: 'var(--font-body)' }} />
            </div>
          </div>
          <div>
            <SectionLabel>Donador</SectionLabel>
            <TriToggle value={props.donador} onChange={props.setDonador} />
          </div>
          <div>
            <SectionLabel>Estado del perfil</SectionLabel>
            <ProfileToggle value={props.estadoPerfil} onChange={props.setEstadoPerfil} />
          </div>
        </div>

      </div>
    </div>
  )
}

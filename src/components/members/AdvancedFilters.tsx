'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { conditionLabel } from '@/lib/condition-labels'
import { STUDY_STAGES } from '@/data/study-catalog'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { useSedes } from '@/lib/sedes'
import { useOrg } from '@/lib/org'
import { useForms } from '@/hooks/useForms'
import { useEventTypes } from '@/hooks/useEventTypes'
import { DatePicker } from '@/components/events/DatePicker'
import type { FormTemplate } from '@/types/forms'
import type { FilterCondition, AddableCondition, StudyStatus, AttendanceType, ServiceStatus, FormResponseStatus, QtyOperator } from '@/types/filters'

const FORM_CATEGORY_LABEL: Record<FormTemplate['category'], string> = {
  event_registration: 'Inscripción eventos',
  study_registration: 'Inscripción estudios',
  survey: 'Encuestas',
  registration: 'Registro',
  other: 'Otros',
}

type Props = {
  conditions: FilterCondition[]
  addCondition: (c: AddableCondition) => void
  removeCondition: (id: number) => void
}

type Tab = 'study' | 'attend' | 'service' | 'form' | 'profile'

const TABS: { key: Tab; label: string }[] = [
  { key: 'study',   label: 'Estudios' },
  { key: 'attend',  label: 'Asistencia' },
  { key: 'service', label: 'Puestos de servicio' },
  { key: 'form',    label: 'Formularios' },
  { key: 'profile', label: 'Perfil' },
]

const QTY_OPS: { value: QtyOperator; label: string }[] = [
  { value: 'any', label: 'Cualquiera' },
  { value: 'gte', label: 'Al menos' },
  { value: 'lte', label: 'Máximo' },
  { value: 'eq',  label: 'Exactamente' },
]

// ─── shared primitives ───────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
      {children}
    </p>
  )
}

function Sel({ value, onChange, children, className }: {
  value: string; onChange: (v: string) => void
  children: React.ReactNode; className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body',
        className,
      )}
    >
      {children}
    </select>
  )
}

function DateRange({ from, to, onFrom, onTo }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void
}) {
  // Mismo date picker de eventos (look Theos), consistente en todos los tabs.
  return (
    <div className="grid grid-cols-2 gap-2">
      <DatePicker value={from} onChange={onFrom} placeholder="Desde" />
      <DatePicker value={to} onChange={onTo} min={from || undefined} placeholder="Hasta" />
    </div>
  )
}

function RadioGroup<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-3 flex-wrap">
      {options.map(opt => (
        <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-coral h-3 w-3"
          />
          <span className="text-xs text-navy-light/70 select-none font-body">
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  )
}

function AddBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-3 w-full rounded-xl bg-navy px-3 py-2 text-sm text-white transition-all hover:bg-navy/80 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed font-body"
    >
      Agregar filtro
    </button>
  )
}

// ─── conditions right panel ──────────────────────────────────────────────────

function ConditionsList({
  conditions, removeCondition, types,
}: {
  conditions: FilterCondition[]
  removeCondition: (id: number) => void
  types: FilterCondition['type'][]
}) {
  const filtered = conditions.filter(c => types.includes(c.type))
  return (
    <div
      className="rounded-xl p-3 h-full bg-surface-low min-h-[120px]"
    >
      <p className="mb-2 text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
        Filtros activos
      </p>
      {filtered.length === 0 ? (
        <p className="text-xs text-navy-light/60 italic font-body">
          Ninguno
        </p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-card px-2.5 py-1.5">
              <span className="text-xs text-navy truncate font-body">
                {conditionLabel(c)}
              </span>
              <button
                onClick={() => removeCondition(c.id)}
                className="shrink-0 text-navy-light/60 hover:text-coral transition-colors"
                aria-label="Quitar"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── panels ──────────────────────────────────────────────────────────────────

function StudyPanel({ addCondition }: Pick<Props, 'addCondition'>) {
  const { studyTypes } = useStudyPlans() // catálogo real de la BD
  const [study, setStudy] = useState('')
  const [status, setStatus] = useState<StudyStatus>('completed')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <Label>Estudio</Label>
        <Sel value={study} onChange={setStudy}>
          <option value="">Seleccioná un estudio</option>
          {(Object.entries(STUDY_STAGES) as [string, { label: string }][]).map(([key, stage]) => (
            <optgroup key={key} label={stage.label}>
              {studyTypes.filter(s => s.stage === key).map(s => (
                <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
              ))}
            </optgroup>
          ))}
        </Sel>
      </div>

      <div>
        <Label>Estado</Label>
        <RadioGroup<StudyStatus>
          options={[
            { value: 'completed',   label: 'Completado' },
            { value: 'in_progress', label: 'En progreso' },
            { value: 'any',         label: 'Cualquiera' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {status === 'completed' && (
        <div>
          <Label>Rango de fechas</Label>
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        </div>
      )}

      <AddBtn
        disabled={!study}
        onClick={() => {
          if (!study) return
          addCondition({
            group: 'study', type: 'study', study, status,
            from: status === 'completed' ? (from || null) : null,
            to: status === 'completed' ? (to || null) : null,
          })
          setStudy('')
        }}
      />
    </div>
  )
}

function AttendPanel({ addCondition }: Pick<Props, 'addCondition'>) {
  const { activeSedes: ACTIVE_SEDES, historicalSedes: HISTORICAL_SEDES } = useSedes()
  const eventTypes = useEventTypes() // catálogo real de la BD (id + nombre)
  const [eventType, setEventType]       = useState('')
  const [sedes, setSedes]               = useState<string[]>([])
  const [camp, setCamp]                 = useState('')
  const [attendanceType, setAttType]    = useState<AttendanceType>('any')
  const [qtyOp, setQtyOp]              = useState<QtyOperator>('any')
  const [qty, setQty]                   = useState('')
  const [from, setFrom]                 = useState('')
  const [to, setTo]                     = useState('')

  function toggleSede(id: string) {
    setSedes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Tipo de evento</Label>
        <Sel value={eventType} onChange={setEventType}>
          <option value="">Cualquier evento</option>
          {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Sel>
      </div>

      {eventType === 'charla' && (
        <div>
          <Label>Sede</Label>
          <div className="space-y-1.5">
            {ACTIVE_SEDES.map(s => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sedes.includes(s.id)} onChange={() => toggleSede(s.id)}
                  className="accent-coral h-3.5 w-3.5 cursor-pointer" />
                <span className="text-xs text-navy-light/70 select-none font-body">
                  {s.name}
                </span>
              </label>
            ))}
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 pt-1 font-display">
              Sedes históricas
            </p>
            {HISTORICAL_SEDES.map(s => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sedes.includes(s.id)} onChange={() => toggleSede(s.id)}
                  className="accent-coral h-3.5 w-3.5 cursor-pointer" />
                <span className="text-xs text-navy-light/60 select-none font-body">
                  {s.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {eventType === 'campamento' && (
        <div>
          <Label>Nombre del campamento</Label>
          <input
            type="text"
            value={camp}
            onChange={e => setCamp(e.target.value)}
            placeholder="Ej: Campamento Verano 2025"
            className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy placeholder-navy-light/50 outline-none focus:ring-1 focus:ring-coral/30 font-body"
          />
        </div>
      )}

      <div>
        <Label>Tipo de asistencia</Label>
        <RadioGroup<AttendanceType>
          options={[
            { value: 'participant', label: 'Participante' },
            { value: 'server',      label: 'Servidor' },
            { value: 'any',         label: 'Cualquiera' },
          ]}
          value={attendanceType}
          onChange={setAttType}
        />
      </div>

      <div>
        <Label>Cantidad de veces</Label>
        <div className="flex gap-2">
          <Sel value={qtyOp} onChange={v => setQtyOp(v as QtyOperator)} className="flex-1">
            {QTY_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Sel>
          {qtyOp !== 'any' && (
            <input
              type="number" min={1} value={qty} onChange={e => setQty(e.target.value)}
              placeholder="Nº"
              className="w-20 rounded-xl bg-surface-low px-2 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            />
          )}
        </div>
      </div>

      <div>
        <Label>Rango de fechas</Label>
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      <AddBtn
        onClick={() => {
          addCondition({
            group: 'attend', type: 'attendance',
            eventType,
            eventTypeName: eventTypes.find(t => t.id === eventType)?.name,
            sedes, camp, attendanceType, qtyOp,
            qty: qtyOp !== 'any' ? qty : '',
            from, to,
          })
          setEventType(''); setSedes([]); setCamp('')
          setAttType('any'); setQtyOp('any'); setQty('')
          setFrom(''); setTo('')
        }}
      />
    </div>
  )
}

function ServicePanel({ addCondition }: Pick<Props, 'addCondition'>) {
  const { areas: AREAS, positions: POSITIONS } = useOrg()
  const [area, setArea]         = useState('')
  const [committee, setComm]    = useState('')
  const [position, setPosition] = useState('')
  const [status, setStatus]     = useState<ServiceStatus>('any')
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')

  const areaCommittees = area
    ? (AREAS.find(a => a.code === area)?.committees as readonly string[] ?? [])
    : []

  function handleAreaChange(v: string) {
    setArea(v)
    setComm('')
    setPosition('')
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Área</Label>
        <Sel value={area} onChange={handleAreaChange}>
          <option value="">Cualquier área</option>
          {AREAS.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
        </Sel>
      </div>

      <div>
        <Label>Comité</Label>
        <Sel value={committee} onChange={setComm}>
          <option value="">Cualquier comité</option>
          {(area ? areaCommittees : AREAS.flatMap(a => a.committees as readonly string[])).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Sel>
      </div>

      <div>
        <Label>Posición</Label>
        <Sel value={position} onChange={setPosition}>
          <option value="">Cualquier posición</option>
          {POSITIONS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Sel>
      </div>

      <div>
        <Label>Estado</Label>
        <RadioGroup<ServiceStatus>
          options={[
            { value: 'active',    label: 'Activo' },
            { value: 'historical', label: 'Histórico' },
            { value: 'any',       label: 'Cualquiera' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      <div>
        <Label>Rango de fechas</Label>
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      <AddBtn
        disabled={!area && !committee && !position}
        onClick={() => {
          addCondition({ group: 'service', type: 'service', area, committee, position, status, from, to })
          setArea(''); setComm(''); setPosition(''); setStatus('any'); setFrom(''); setTo('')
        }}
      />
    </div>
  )
}

function FormPanel({ addCondition }: Pick<Props, 'addCondition'>) {
  const { forms } = useForms()
  const [formId, setFormId]         = useState('')
  const [status, setStatus]         = useState<FormResponseStatus>('any')
  const [from, setFrom]             = useState('')
  const [to, setTo]                 = useState('')
  const [field, setField]           = useState('')
  const [fieldVal, setFieldVal]     = useState('')

  const selectedForm = forms.find(f => f.id === formId)
  // Solo campos que reciben respuesta (excluye separadores de página/sección).
  const answerableFields = (selectedForm?.fields ?? []).filter(
    f => f.type !== 'section' && f.type !== 'page_break',
  )

  function handleFormChange(v: string) {
    setFormId(v)
    setField('')
    setFieldVal('')
  }

  const groupedForms = Object.entries(
    forms.reduce<Record<string, FormTemplate[]>>((acc, f) => {
      ;(acc[f.category] ??= []).push(f)
      return acc
    }, {})
  )

  return (
    <div className="space-y-4">
      <div>
        <Label>Formulario</Label>
        <Sel value={formId} onChange={handleFormChange}>
          <option value="">Seleccioná un formulario</option>
          {groupedForms.map(([cat, forms]) => (
            <optgroup key={cat} label={FORM_CATEGORY_LABEL[cat as keyof typeof FORM_CATEGORY_LABEL] ?? cat}>
              {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </optgroup>
          ))}
        </Sel>
      </div>

      <div>
        <Label>Estado</Label>
        <RadioGroup<FormResponseStatus>
          options={[
            { value: 'filled',     label: 'Llenó' },
            { value: 'not_filled', label: 'No llenó' },
            { value: 'any',        label: 'Cualquiera' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {status !== 'not_filled' && (
        <div>
          <Label>Rango de fechas</Label>
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        </div>
      )}

      {selectedForm && status !== 'not_filled' && (
        <div className="space-y-2">
          <div>
            <Label>Campo del formulario</Label>
            <Sel value={field} onChange={setField}>
              <option value="">Cualquier campo</option>
              {answerableFields.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </Sel>
          </div>
          {field && (
            <div>
              <Label>Valor (* = comodín)</Label>
              <input
                type="text"
                value={fieldVal}
                onChange={e => setFieldVal(e.target.value)}
                placeholder="Ej: San José o San*"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy placeholder-navy-light/50 outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
          )}
        </div>
      )}

      <AddBtn
        disabled={!formId}
        onClick={() => {
          if (!formId) return
          const form = forms.find(f => f.id === formId)
          addCondition({
            group: 'form', type: 'form',
            formId, formName: form?.name ?? formId,
            status, from, to, field, fieldVal,
          })
          setFormId(''); setStatus('any'); setFrom(''); setTo('')
          setField(''); setFieldVal('')
        }}
      />
    </div>
  )
}

function ProfilePanel({ conditions, addCondition, removeCondition }: Props) {
  const donorCond  = conditions.find(c => c.type === 'donor')  as Extract<FilterCondition, { type: 'donor'  }> | undefined
  const statusCond = conditions.find(c => c.type === 'status') as Extract<FilterCondition, { type: 'status' }> | undefined
  const leaderCond = conditions.find(c => c.type === 'leader') as Extract<FilterCondition, { type: 'leader' }> | undefined
  const ageCond    = conditions.find(c => c.type === 'age')    as Extract<FilterCondition, { type: 'age'    }> | undefined
  const maritalCond = conditions.find(c => c.type === 'marital') as Extract<FilterCondition, { type: 'marital' }> | undefined
  const accountCond = conditions.find(c => c.type === 'account') as Extract<FilterCondition, { type: 'account' }> | undefined

  const donorVal  = donorCond  ? donorCond.value  : 'any'
  const statusVal = statusCond ? statusCond.value : 'any'
  const leaderVal = leaderCond ? leaderCond.value : 'any'
  const maritalVal = maritalCond ? maritalCond.value : 'any'
  const accountVal = accountCond ? accountCond.value : 'any'

  const [ageMin, setAgeMin] = useState(ageCond?.min ?? '')
  const [ageMax, setAgeMax] = useState(ageCond?.max ?? '')

  useEffect(() => {
    if (!ageCond) { setAgeMin(''); setAgeMax('') }
  }, [ageCond])

  function syncAge() {
    if (ageCond) removeCondition(ageCond.id)
    if (ageMin || ageMax) addCondition({ group: 'age', type: 'age', min: ageMin, max: ageMax })
  }

  // Fecha de creación del perfil (rango sobre members.created_at).
  const createdCond = conditions.find(c => c.type === 'created') as Extract<FilterCondition, { type: 'created' }> | undefined
  const [createdFrom, setCreatedFrom] = useState(createdCond?.from ?? '')
  const [createdTo, setCreatedTo] = useState(createdCond?.to ?? '')
  useEffect(() => { if (!createdCond) { setCreatedFrom(''); setCreatedTo('') } }, [createdCond])
  function syncCreated(from: string, to: string) {
    setCreatedFrom(from); setCreatedTo(to)
    if (createdCond) removeCondition(createdCond.id)
    if (from || to) addCondition({ group: 'created', type: 'created', from, to })
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Donador</Label>
        <Sel value={donorVal} onChange={v => {
          if (donorCond) removeCondition(donorCond.id)
          if (v !== 'any') addCondition({ group: 'donor', type: 'donor', value: v as 'yes' | 'no' })
        }}>
          <option value="any">Cualquiera</option>
          <option value="yes">Sí</option>
          <option value="no">No</option>
        </Sel>
      </div>

      <div>
        <Label>Estado civil</Label>
        <Sel value={maritalVal} onChange={v => {
          if (maritalCond) removeCondition(maritalCond.id)
          if (v !== 'any') addCondition({ group: 'marital', type: 'marital', value: v })
        }}>
          <option value="any">Cualquiera</option>
          <option value="Soltero/a">Soltero/a</option>
          <option value="Casado/a">Casado/a</option>
          <option value="Unión libre">Unión libre</option>
          <option value="Divorciado/a">Divorciado/a</option>
          <option value="Viudo/a">Viudo/a</option>
        </Sel>
      </div>

      <div>
        <Label>Estado del perfil</Label>
        <Sel value={statusVal} onChange={v => {
          if (statusCond) removeCondition(statusCond.id)
          if (v !== 'any') addCondition({ group: 'status', type: 'status', value: v as 'active' | 'inactive' })
        }}>
          <option value="any">Cualquiera</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </Sel>
      </div>

      <div>
        <Label>Dirigente</Label>
        <Sel value={leaderVal} onChange={v => {
          if (leaderCond) removeCondition(leaderCond.id)
          if (v !== 'any') addCondition({ group: 'leader', type: 'leader', value: v as 'yes' | 'no' })
        }}>
          <option value="any">Cualquiera</option>
          <option value="yes">Sí</option>
          <option value="no">No</option>
        </Sel>
      </div>

      <div>
        <Label>Estado de cuenta</Label>
        <Sel value={accountVal} onChange={v => {
          if (accountCond) removeCondition(accountCond.id)
          if (v !== 'any') addCondition({ group: 'account', type: 'account', value: v as 'none' | 'unconfirmed' | 'active' })
        }}>
          <option value="any">Cualquiera</option>
          <option value="none">Sin cuenta</option>
          <option value="unconfirmed">Sin activar</option>
          <option value="active">Activada</option>
        </Sel>
      </div>

      <div>
        <Label>Rango de edad</Label>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} max={120} value={ageMin}
            onChange={e => setAgeMin(e.target.value)}
            onBlur={syncAge}
            placeholder="Mín"
            className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy placeholder-navy-light/50 outline-none focus:ring-1 focus:ring-coral/30 font-body"
          />
          <span className="text-navy-light/60 shrink-0 text-sm">–</span>
          <input
            type="number" min={0} max={120} value={ageMax}
            onChange={e => setAgeMax(e.target.value)}
            onBlur={syncAge}
            placeholder="Máx"
            className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy placeholder-navy-light/50 outline-none focus:ring-1 focus:ring-coral/30 font-body"
          />
        </div>
      </div>

      <div>
        <Label>Fecha de creación del perfil</Label>
        <DateRange from={createdFrom} to={createdTo}
          onFrom={v => syncCreated(v, createdTo)} onTo={v => syncCreated(createdFrom, v)} />
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function AdvancedFilters({ conditions, addCondition, removeCondition }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('study')

  const conditionTypes: Record<Tab, FilterCondition['type'][]> = {
    study:   ['study'],
    attend:  ['attendance'],
    service: ['service'],
    form:    ['form'],
    profile: ['donor', 'age', 'status', 'leader', 'marital', 'created'],
  }

  return (
    <div
      className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]"
    >
      {/* Tab bar */}
      <div
        className="flex gap-0 border-b overflow-x-auto border-[var(--outline-variant)]"
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 px-4 py-3 text-sm transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'text-navy border-b-2 border-navy -mb-px'
                : 'text-navy-light/60 hover:text-navy-light',
              'font-body',
            )}
          >
            {tab.label}
            {conditionTypes[tab.key].some(t => conditions.some(c => c.type === t)) && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-coral text-[9px] text-white">
                {conditions.filter(c => conditionTypes[tab.key].includes(c.type)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Two-column body */}
      <div className="grid gap-0 grid-cols-[1fr_260px]">
        {/* Left: inputs */}
        <div className="p-5 border-r border-[var(--outline-variant)]">
          {activeTab === 'study'   && <StudyPanel  addCondition={addCondition} />}
          {activeTab === 'attend'  && <AttendPanel addCondition={addCondition} />}
          {activeTab === 'service' && <ServicePanel addCondition={addCondition} />}
          {activeTab === 'form'    && <FormPanel   addCondition={addCondition} />}
          {activeTab === 'profile' && (
            <ProfilePanel
              conditions={conditions}
              addCondition={addCondition}
              removeCondition={removeCondition}
            />
          )}
        </div>

        {/* Right: active conditions for this tab */}
        <div className="p-4">
          <ConditionsList
            conditions={conditions}
            removeCondition={removeCondition}
            types={conditionTypes[activeTab]}
          />
        </div>
      </div>
    </div>
  )
}

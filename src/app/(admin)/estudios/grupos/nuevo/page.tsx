'use client'

import { useState } from 'react'
import { useToast } from '@/components/shared/Toast'
import Link from 'next/link'
import { useStudies } from '@/hooks/useStudies'
import { useDirigentes } from '@/hooks/useDirigentes'
import { sedeLabel, useSedes } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { DirigentesCombobox } from '@/components/shared/DirigentesCombobox'
import { cn } from '@/lib/utils'
import { ChevronLeft, CheckCircle } from 'lucide-react'
import type { GroupStatus } from '@/types/study'

const STATUS_OPTIONS: Array<{ value: GroupStatus; label: string }> = [
  { value: 'en_matricula', label: 'En matrícula' },
  { value: 'en_curso',     label: 'En curso' },
]

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_LABELS: Record<string, string> = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo',
}

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

type Step1 = {
  study_type_id: string
  zone: string
  age_from: string
  age_to: string
  days: string[]
  time: string
  location: string
  capacity: string
  start_date: string
  signup_deadline: string
}

export default function NuevoGrupoPage() {
  const toast = useToast()
  const { activeSedes: SEDES } = useSedes()
  const { studyTypes } = useStudies()
  const { dirigentes } = useDirigentes()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [step1, setStep1] = useState<Step1>({
    study_type_id: '',
    zone: 'all',
    age_from: '',
    age_to: '',
    days: [],
    time: '',
    location: '',
    capacity: '10',
    start_date: '',
    signup_deadline: '',
  })
  const [selectedLeader, setSelectedLeader] = useState('')
  const [selectedCoLeader, setSelectedCoLeader] = useState('')
  const [pendingLeader, setPendingLeader] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [statusOverride, setStatusOverride] = useState<GroupStatus | ''>('')
  const [created, setCreated] = useState(false)

  function setS1<K extends keyof Step1>(key: K, value: Step1[K]) {
    setStep1(prev => ({ ...prev, [key]: value }))
  }

  function toggleDay(d: string) {
    setS1('days', step1.days.includes(d)
      ? step1.days.filter(x => x !== d)
      : [...step1.days, d])
  }

  const studyType = studyTypes.find(s => s.id === step1.study_type_id)

  const leaderData = dirigentes.find(d => d.member_id === selectedLeader)
  const coLeaderData = dirigentes.find(d => d.member_id === selectedCoLeader)

  // Estado inicial: el usuario puede elegirlo; por defecto En matrícula.
  // "Sin dirigente" ya no es estado: es un flag derivado de leader_id null.
  const initialStatus: GroupStatus = statusOverride || 'en_matricula'

  async function handleCreate() {
    if (!studyType) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/studies/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          study_type_id: studyType.code,
          name: `${studyType.code} — ${step1.zone && step1.zone !== 'all' ? sedeLabel(step1.zone) : 'Todas las zonas'}`,
          leader_id: leaderData?.member_id ?? null,
          co_leader_id: coLeaderData?.member_id ?? null,
          zone: step1.zone && step1.zone !== 'all' ? step1.zone : null,
          schedule_days: step1.days,
          schedule_time: step1.time || null,
          location: step1.location || null,
          max_students: step1.capacity ? Number(step1.capacity) : null,
          starts_at: step1.start_date || null,
          status: initialStatus,
        }),
      })
      if (!res.ok) throw new Error('Error creando el grupo')
      setCreated(true)
    } catch (e) {
      console.error(e)
      toast('No se pudo crear el grupo. Revisá los datos e intentá de nuevo.', 'error')
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <CheckCircle size={48} className="text-teal-deep mx-auto" />
          <p className="text-xl font-bold text-navy font-display">
            ¡Grupo creado!
          </p>
          <p className="text-sm text-navy-light/60 font-body">
            El grupo quedó en estado «{STATUS_OPTIONS.find(o => o.value === initialStatus)?.label}».
            {pendingLeader && ' Se notificó al equipo de estudios para asignar dirigente.'}
          </p>
          <Link
            href="/estudios/grupos"
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors mt-2"
          >
            Ver todos los grupos
          </Link>
        </div>
      </div>
    )
  }

  const niveles = studyTypes.filter(s => s.stage === 'niveles')
  const inicial = studyTypes.filter(s => s.stage === 'inicial')
  const intermedia = studyTypes.filter(s => s.stage === 'intermedia')

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <Link
        href="/estudios/grupos"
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} />
        Volver a grupos
      </Link>

      <div>
        <h1
          className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
        >
          Nuevo grupo
        </h1>
        <p className="mt-1 text-sm text-navy-light/60 font-body">
          Completa los 3 pasos para crear el grupo
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all',
                step >= n
                  ? 'bg-coral text-white'
                  : 'bg-surface-low text-navy-light/40',
                'font-display',
              )}
            >
              {n}
            </div>
            <span
              className={cn('text-[12px]', step >= n ? 'text-navy' : 'text-navy-light/40', 'font-body')}
            >
              {n === 1 ? 'Configuración' : n === 2 ? 'Dirigente' : 'Confirmación'}
            </span>
            {n < 3 && <div className="h-px w-8 bg-surface-low" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
          <h2
            className="text-[10px] tracking-widest uppercase text-navy-light/40 font-display"
          >
            Paso 1 — Configuración
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Tipo de estudio *
              </label>
              <select
                className={inputCls}
                value={step1.study_type_id}
                onChange={e => setS1('study_type_id', e.target.value)}
              >
                <option value="">Seleccionar...</option>
                <optgroup label="Niveles">
                  {niveles.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </optgroup>
                <optgroup label="Etapa Inicial">
                  {inicial.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </optgroup>
                <optgroup label="Etapa Intermedia">
                  {intermedia.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </optgroup>
              </select>
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Zona *
              </label>
              <select
                className={inputCls}
                value={step1.zone}
                onChange={e => setS1('zone', e.target.value)}
              >
                <option value="all">Todas las zonas</option>
                {SEDES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Edad desde
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="18"
                value={step1.age_from}
                onChange={e => setS1('age_from', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Edad hasta
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="35"
                value={step1.age_to}
                onChange={e => setS1('age_to', e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Días preferidos
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-all',
                      step1.days.includes(d)
                        ? 'bg-navy text-white border-navy'
                        : 'text-navy-light hover:bg-surface-low',
                      'border-[var(--outline-variant)] font-display',
                    )}
                  >
                    {DAY_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Horario preferido
              </label>
              <input
                className={inputCls}
                placeholder="7:30pm"
                value={step1.time}
                onChange={e => setS1('time', e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Ubicación exacta
              </label>
              <input
                className={inputCls}
                placeholder="Edificio Meridiano, Escazú"
                value={step1.location}
                onChange={e => setS1('location', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Capacidad máxima
              </label>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={step1.capacity}
                onChange={e => setS1('capacity', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Fecha de inicio estimada
              </label>
              <input
                type="date"
                className={inputCls}
                value={step1.start_date}
                onChange={e => setS1('start_date', e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-navy-light/60 font-display">
                Fecha límite de inscripción (opcional)
              </label>
              <input
                type="date"
                className={inputCls}
                value={step1.signup_deadline}
                onChange={e => setS1('signup_deadline', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(2)}
              disabled={!step1.study_type_id || !step1.zone}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
          <h2
            className="text-[10px] tracking-widest uppercase text-navy-light/40 font-display"
          >
            Paso 2 — Seleccionar dirigente
          </h2>

          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">
              Dirigente {pendingLeader ? '' : '*'}
            </label>
            <DirigentesCombobox
              value={selectedLeader || null}
              onChange={id => setSelectedLeader(id ?? '')}
              excludeId={selectedCoLeader || undefined}
              placeholder={pendingLeader ? 'Pendiente de asignar' : 'Buscar dirigente…'}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-coral"
              checked={pendingLeader}
              onChange={e => { setPendingLeader(e.target.checked); if (e.target.checked) { setSelectedLeader(''); setConfirmed(false) } }}
            />
            <span className="text-sm text-navy-light/70 font-body">
              Dejar dirigente <strong>pendiente</strong> (asignar después)
            </span>
          </label>

          {!pendingLeader && selectedLeader && (
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">
                Co-dirigente (opcional)
              </label>
              <DirigentesCombobox
                value={selectedCoLeader || null}
                onChange={id => setSelectedCoLeader(id ?? '')}
                excludeId={selectedLeader || undefined}
                placeholder="Buscar co-dirigente…"
                aria-label="Buscar co-dirigente"
              />
            </div>
          )}

          {!pendingLeader && selectedLeader && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-coral"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
              />
              <span className="text-sm text-navy-light/70 font-body">
                Ya fue contactado y confirmó su disponibilidad
              </span>
            </label>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
            >
              ← Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={pendingLeader ? false : (!selectedLeader || !confirmed)}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
          <h2
            className="text-[10px] tracking-widest uppercase text-navy-light/40 font-display"
          >
            Paso 3 — Confirmación
          </h2>

          <div className="rounded-xl p-4 space-y-3 bg-surface-low">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-navy-light/40 mb-0.5 font-display">Tipo</p>
                <StudyTypeBadge code={studyType?.code ?? ''} name={studyType?.name} size="sm" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-navy-light/40 mb-0.5 font-display">Zona</p>
                <p className="text-navy font-body">{step1.zone ? sedeLabel(step1.zone) : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-navy-light/40 mb-0.5 font-display">Días</p>
                <p className="text-navy font-body">{step1.days.length > 0 ? step1.days.map(d => DAY_LABELS[d]).join(', ') : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-navy-light/40 mb-0.5 font-display">Horario</p>
                <p className="text-navy font-body">{step1.time || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-navy-light/40 mb-0.5 font-display">Dirigente</p>
                <p className="text-navy font-body">{leaderData?.member_name ?? (pendingLeader ? 'Pendiente' : '—')}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-navy-light/40 mb-0.5 font-display">Inicio estimado</p>
                <p className="text-navy font-body">{step1.start_date || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-navy-light/40 mb-0.5 font-display">Capacidad</p>
                <p className="text-navy font-body">{step1.capacity} personas</p>
              </div>
              <div>
                <label className="text-[10px] uppercase text-navy-light/60 mb-0.5 font-display block" htmlFor="nuevo-grupo-estado">Estado inicial</label>
                <select
                  id="nuevo-grupo-estado"
                  className={inputCls}
                  value={initialStatus}
                  onChange={e => setStatusOverride(e.target.value as GroupStatus)}
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
            >
              ← Atrás
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
            >
              {submitting ? 'Creando...' : 'Crear grupo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

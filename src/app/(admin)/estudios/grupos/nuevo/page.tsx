'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/shared/Toast'
import Link from 'next/link'
import { useStudies } from '@/hooks/useStudies'
import { useDirigentes } from '@/hooks/useDirigentes'
import type { Dirigente } from '@/lib/dirigentes'
import { isPrematGroup, canLeadPremat, prematGroupError } from '@/lib/studies/premat-group'
import { useSedes } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { DirigentesCombobox } from '@/components/shared/DirigentesCombobox'
import { Combobox, type ComboValue } from '@/components/shared/Combobox'
import { TimePicker } from '@/components/events/TimePicker'
import { resolveZoneCode } from '@/lib/zones'
import { isCapacitacion, addDays } from '@/lib/studies/bloques'
import { zoneOnVirtualToggle } from '@/lib/studies/virtual-zone'
import { toYmdLocal } from '@/lib/format'
import { cn } from '@/lib/utils'
import { minEnrollmentEnd, maxEnrollmentEnd } from '@/lib/studies/enrollment-window'
import { ChevronLeft, CheckCircle } from 'lucide-react'
import type { GroupStatus } from '@/types/study'
import { canAdvanceLeaderStep, leaderStepHint } from '@/lib/studies/leader-step'
import { AudienceRestrictionSection } from '@/components/studies/AudienceRestrictionSection'
import type { GroupRestriction } from '@/lib/studies/group-restrictions'

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
  age_from: string
  age_to: string
  days: string[]
  time: string
  location: string
  capacity: string
  start_date: string
  /** GRU-1: ventana de matrícula (reemplaza el viejo signup_deadline muerto). */
  enrollment_start: string
  enrollment_end: string
  is_virtual: boolean
}

export default function NuevoGrupoPage() {
  const toast = useToast()
  const { zoneSedes: SEDES, activeSedes: ACTIVE_SEDES } = useSedes()
  const { studyTypes } = useStudies('plans')
  const { dirigentes } = useDirigentes()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  // Zona: "Todas las zonas" se modela como un item existente con value 'all'.
  const [zoneSel, setZoneSel] = useState<ComboValue>({ kind: 'existing', value: 'all', label: 'Todas las zonas' })
  const [step1, setStep1] = useState<Step1>({
    study_type_id: '',
    age_from: '',
    age_to: '',
    days: [],
    time: '19:00', // 7:00 p.m. por defecto
    location: '',
    capacity: '10',
    start_date: '',
    // La ventana de matrícula abre por defecto HOY → HOY (editable).
    enrollment_start: toYmdLocal(new Date()),
    enrollment_end: toYmdLocal(new Date()),
    is_virtual: false,
  })
  // GRU-2: restricción de audiencia del grupo (null = abierto, lo normal).
  const [restriction, setRestriction] = useState<GroupRestriction | null>(null)
  const [selectedLeader, setSelectedLeader] = useState('')
  const [selectedCoLeader, setSelectedCoLeader] = useState('')
  const [pendingLeader, setPendingLeader] = useState(false)
  // Sede de envío de folletos: TBD por defecto; '__otro__' abre el detalle.
  const [folletosSedeSel, setFolletosSedeSel] = useState('TBD')
  const [folletosSedeOtro, setFolletosSedeOtro] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // Regla del paso 2 (pura y testeada): se avanza con el dirigente confirmado o
  // dejándolo pendiente. El co-dirigente no entra en la validación.
  const leaderStep = { selectedLeader, confirmed, pendingLeader }
  const puedeAvanzarDirigente = canAdvanceLeaderStep(leaderStep)
  const leaderHint = leaderStepHint(leaderStep)
  const [statusOverride, setStatusOverride] = useState<GroupStatus | ''>('')
  const [created, setCreated] = useState(false)

  function setS1<K extends keyof Step1>(key: K, value: Step1[K]) {
    setStep1(prev => ({ ...prev, [key]: value }))
  }

  // Un grupo tiene un único día: seleccionar reemplaza; volver a tocar el
  // mismo lo quita. Se guarda igual como array (schedule_days) con 0 o 1 día.
  function toggleDay(d: string) {
    setS1('days', step1.days.includes(d) ? [] : [d])
  }

  const studyType = studyTypes.find(s => s.id === step1.study_type_id)
  // INT-3: la zona del grupo es una sede y la sede tiene su moneda.
  const zonaSede = zoneSel.kind === 'existing' && zoneSel.value !== 'all'
    ? SEDES.find(s => s.id === zoneSel.value) : undefined
  const monedaZonaDistinta = !!zonaSede && !!studyType?.requires_payment
    && (zonaSede.currency ?? 'CRC') !== (studyType.currency ?? 'CRC')

  // Si el usuario ya tocó las fechas a mano, la precarga del bloque no las pisa.
  const [enrollTouched, setEnrollTouched] = useState(false)

  // GRU-1: si el plan es una capacitación, precargar la ventana de matrícula
  // desde el bloque vigente/próximo (primer hito = apertura − 3 semanas; fin =
  // cierre de matrícula del bloque). Siempre editable; best-effort (el fetch de
  // bloques exige coordinador_estudios — otros roles simplemente no precargan).
  useEffect(() => {
    if (!studyType?.code || !isCapacitacion(studyType.code)) return
    if (enrollTouched) return
    let alive = true
    fetch('/api/studies/bloques')
      .then(r => (r.ok ? r.json() : []))
      .then((bloques: Array<{ fecha_apertura: string; fecha_cierre_matricula: string }>) => {
        if (!alive || !Array.isArray(bloques)) return
        const today = toYmdLocal(new Date())
        const vigente = bloques
          .filter(b => b.fecha_cierre_matricula >= today)
          .sort((a, b) => a.fecha_apertura.localeCompare(b.fecha_apertura))[0]
        if (!vigente) return
        setStep1(prev => ({
          ...prev,
          enrollment_start: addDays(vigente.fecha_apertura, -21),
          enrollment_end: vigente.fecha_cierre_matricula,
        }))
      })
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyType?.code])

  const leaderData = dirigentes.find(d => d.member_id === selectedLeader)
  const coLeaderData = dirigentes.find(d => d.member_id === selectedCoLeader)

  // PRE-11 · El prematrimonial se da EN PAREJA: los dos son obligatorios y solo
  // se ofrecen los habilitados. En cualquier otro plan nada de esto aplica.
  const esPremat = isPrematGroup(studyType?.code)
  const capacityOf = (memberId: string) => {
    const d = dirigentes.find(x => x.member_id === memberId)
    return d ? { formacion: d.formacion, disponibilidad: d.disponibilidad } : null
  }
  const filtroPremat = esPremat
    ? (d: Dirigente) => canLeadPremat({ formacion: d.formacion, disponibilidad: d.disponibilidad })
    : undefined
  const errorPremat = prematGroupError({
    planCode: studyType?.code,
    leaderId: pendingLeader ? null : selectedLeader,
    coLeaderId: selectedCoLeader,
    capabilityOf: capacityOf,
  })

  // Estado inicial: el usuario puede elegirlo; por defecto En matrícula.
  // "Sin dirigente" ya no es estado: es un flag derivado de leader_id null.
  const initialStatus: GroupStatus = statusOverride || 'en_matricula'

  async function handleCreate() {
    if (!studyType) return
    // El API valida igual; esto evita el viaje y da el mensaje al instante.
    if (errorPremat) { toast(errorPremat, 'error'); return }
    setSubmitting(true)
    try {
      // Resolver la zona: 'all'/vacío → null (todas); existente → su code; nueva →
      // crear la sede (dedup server-side) y usar su code.
      const isAll = zoneSel.kind === 'empty' || (zoneSel.kind === 'existing' && zoneSel.value === 'all')
      const zoneCode = isAll ? null : await resolveZoneCode(zoneSel)
      const zoneName = isAll ? 'Todas las zonas' : zoneSel.label
      const res = await fetch('/api/studies/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          study_type_id: studyType.code,
          name: `${studyType.code} — ${zoneName}`,
          leader_id: leaderData?.member_id ?? null,
          co_leader_id: coLeaderData?.member_id ?? null,
          zone: zoneCode,
          schedule_days: step1.days,
          schedule_time: step1.time || null,
          location: step1.location || null,
          max_students: step1.capacity ? Number(step1.capacity) : null,
          folletos_sede: folletosSedeSel === '__otro__'
            ? (folletosSedeOtro.trim() ? `Otro: ${folletosSedeOtro.trim()}` : 'TBD')
            : folletosSedeSel,
          age_min: step1.age_from ? Number(step1.age_from) : null,
          age_max: step1.age_to ? Number(step1.age_to) : null,
          starts_at: step1.start_date || null,
          enrollment_start_date: step1.enrollment_start || null,
          enrollment_end_date: step1.enrollment_end || null,
          status: initialStatus,
          is_virtual: step1.is_virtual,
          enrollment_restrictions: restriction,
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
          <p className="text-sm text-navy-light/80 font-body">
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

  // Solo tipos activos: no se pueden crear grupos de estudios desactivados.
  const activeTypes = studyTypes.filter(s => !s.is_archived)
  const niveles = activeTypes.filter(s => s.stage === 'niveles')
  const inicial = activeTypes.filter(s => s.stage === 'inicial')
  const intermedia = activeTypes.filter(s => s.stage === 'intermedia')
  const avanzada = activeTypes.filter(s => s.stage === 'avanzada')

  return (
    <div className="w-full space-y-6">
      {/* Back */}
      <Link
        href="/estudios/grupos"
        className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
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
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          Completa los 3 pasos para crear el grupo
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-[13px] font-bold transition-all',
                step >= n
                  ? 'bg-coral text-white'
                  : 'bg-surface-low text-navy-light/80',
                'font-display',
              )}
            >
              {n}
            </div>
            <span
              className={cn('text-[13px]', step >= n ? 'text-navy' : 'text-navy-light/80', 'font-body')}
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
            className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
          >
            Paso 1 — Configuración
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2 space-y-1">
              <label htmlFor="tipo-de-estudio" className="text-[13px] text-navy-light/80 font-display">
                Tipo de estudio *
              </label>
              <select id="tipo-de-estudio"
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
                <optgroup label="Etapa Avanzada">
                  {avanzada.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </optgroup>
              </select>
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-1">
              <span className="text-[13px] text-navy-light/80 font-display">
                Zona *
              </span>
              {step1.is_virtual ? (
                // EST-4: en grupos virtuales la zona queda fija en "Virtual".
                <p className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy-light/80 font-body" aria-label="Zona fijada: Virtual">
                  Virtual (fijada por ser grupo virtual)
                </p>
              ) : (
                <Combobox
                  ariaLabel="Zona"
                  items={[{ value: 'all', label: 'Todas las zonas' }, ...SEDES.map(s => ({ value: s.id, label: s.name }))]}
                  value={zoneSel}
                  onChange={setZoneSel}
                  allowCreate={false}
                  placeholder="Buscar zona…"
                />
              )}
              {/* INT-3: la zona ES la sede. Si esa sede cobra en otra moneda que
                  el plan, el cobro de matrícula saldría en la moneda del PLAN —
                  el monto vive ahí y convertirlo sería inventar un tipo de
                  cambio. Se avisa para que se use un plan con el precio correcto. */}
              {monedaZonaDistinta && (
                <p className="text-[13px] text-coral font-body">
                  {zonaSede?.name} cobra en {zonaSede?.currency} y este estudio está en{' '}
                  {studyType?.currency ?? 'CRC'}: la matrícula se cobraría en{' '}
                  {studyType?.currency ?? 'CRC'}. Si el precio es en {zonaSede?.currency},
                  usá un plan con ese precio.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="edad-desde" className="text-[13px] text-navy-light/80 font-display">
                Edad desde
              </label>
              <input id="edad-desde"
                type="number"
                className={inputCls}
                placeholder="18"
                value={step1.age_from}
                onChange={e => setS1('age_from', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edad-hasta" className="text-[13px] text-navy-light/80 font-display">
                Edad hasta
              </label>
              <input id="edad-hasta"
                type="number"
                className={inputCls}
                placeholder="35"
                value={step1.age_to}
                onChange={e => setS1('age_to', e.target.value)}
              />
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-1">
              <span className="text-[13px] text-navy-light/80 font-display">
                Día preferido
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[13px] font-medium border transition-all',
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

            <div className="col-span-1 space-y-1">
              <span className="text-[13px] text-navy-light/80 font-display">
                Horario preferido
              </span>
              <TimePicker ariaLabel="Horario preferido" value={step1.time} onChange={v => setS1('time', v)} placeholder="Hora" />
            </div>

            <div className="col-span-1 space-y-1">
              <label htmlFor="capacidad-maxima" className="text-[13px] text-navy-light/80 font-display">
                Capacidad máxima
              </label>
              <input id="capacidad-maxima"
                type="number"
                min={1}
                className={inputCls}
                value={step1.capacity}
                onChange={e => setS1('capacity', e.target.value)}
              />
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-1">
              <label htmlFor="ubicacion-exacta" className="text-[13px] text-navy-light/80 font-display">
                Ubicación exacta
              </label>
              <input id="ubicacion-exacta"
                className={inputCls}
                placeholder="Edificio Meridiano, Escazú"
                value={step1.location}
                onChange={e => setS1('location', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="fecha-de-inicio-estimada" className="text-[13px] text-navy-light/80 font-display">
                Fecha de inicio estimada
              </label>
              <input id="fecha-de-inicio-estimada"
                type="date"
                className={inputCls}
                value={step1.start_date}
                onChange={e => setS1('start_date', e.target.value)}
              />
            </div>

            {/* GRU-1: ventana de matrícula. El grupo solo acepta matrículas
                dentro del rango; al vencer, el cron lo pasa a en_curso si ya
                inició. Vacías = modo manual (comportamiento histórico). */}
            <div className="space-y-1">
              <label htmlFor="inicio-de-matricula" className="text-[13px] text-navy-light/80 font-display">
                Inicio de matrícula
              </label>
              <input id="inicio-de-matricula"
                type="date"
                className={inputCls}
                value={step1.enrollment_start}
                max={step1.enrollment_end || undefined}
                onChange={e => { setEnrollTouched(true); setS1('enrollment_start', e.target.value) }}
              />
            </div>
            {/* Fin de matrícula: nunca antes del inicio ni antes de hoy; el
                tope es el arranque del grupo SOLO si es futuro (acotar por un
                arranque pasado dejaba el campo inservible). */}
            <div className="space-y-1">
              <label htmlFor="fin-de-matricula" className="text-[13px] text-navy-light/80 font-display">
                Fin de matrícula
              </label>
              <input id="fin-de-matricula"
                type="date"
                className={inputCls}
                value={step1.enrollment_end}
                min={minEnrollmentEnd(step1.enrollment_start, toYmdLocal(new Date()))}
                max={maxEnrollmentEnd(step1.start_date, toYmdLocal(new Date()))}
                onChange={e => { setEnrollTouched(true); setS1('enrollment_end', e.target.value) }}
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-coral"
                  checked={step1.is_virtual}
                  onChange={e => {
                    // EST-4: virtual fija la zona "Virtual"; desmarcar la limpia.
                    setS1('is_virtual', e.target.checked)
                    setZoneSel(prev => zoneOnVirtualToggle(e.target.checked, prev, { kind: 'existing', value: 'all', label: 'Todas las zonas' }))
                  }}
                />
                <span className="text-sm text-navy-light/80 font-body">
                  Grupo <strong>virtual</strong> (solo lo ven miembros autorizados para estudios virtuales)
                </span>
              </label>
            </div>
          </div>

          {/* GRU-2 · A quién se le ofrece este grupo (opcional). */}
          <AudienceRestrictionSection value={restriction} onChange={setRestriction} />

          <div className="flex flex-col items-end gap-1.5 pt-2">
            {!step1.study_type_id && (
              <p className="text-[13px] text-navy-light/80 font-body" role="status">
                Para continuar, seleccioná el tipo de estudio.
              </p>
            )}
            <button
              onClick={() => setStep(2)}
              disabled={!step1.study_type_id}
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
            className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
          >
            Paso 2 — Seleccionar dirigente
          </h2>

          {/* Todo lo del DIRIGENTE junto en un bloque: el combobox y sus dos
              casillas. Antes la casilla de disponibilidad quedaba DESPUÉS del
              co-dirigente y parecía referirse a él (bug 2026-08-04). */}
          <fieldset className="rounded-xl border border-[var(--outline-variant)] bg-surface-low/60 p-4 space-y-3">
            <legend className="px-1 text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
              Dirigente {pendingLeader ? '' : '*'}
            </legend>

            <DirigentesCombobox
              value={selectedLeader || null}
              onChange={id => setSelectedLeader(id ?? '')}
              excludeId={selectedCoLeader || undefined}
              filter={filtroPremat}
              placeholder={pendingLeader ? 'Pendiente de asignar' : 'Buscar dirigente…'}
              ariaLabel="Buscar dirigente"
            />
            {esPremat && (
              <p className="text-[13px] text-navy-light/80 font-body">
                Solo se listan las personas habilitadas para dar prematrimonial.
              </p>
            )}

            {!pendingLeader && selectedLeader && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-coral"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                />
                <span className="text-sm text-navy-light/80 font-body">
                  El <strong>dirigente</strong> ya fue contactado y confirmó su disponibilidad
                </span>
              </label>
            )}

            {/* PRE-11: en PREMAT no se puede dejar pendiente — si los dos son
                obligatorios, "pendiente" sería la puerta de atrás. */}
            {!esPremat && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-coral"
                  checked={pendingLeader}
                  onChange={e => { setPendingLeader(e.target.checked); if (e.target.checked) { setSelectedLeader(''); setConfirmed(false) } }}
                />
                <span className="text-sm text-navy-light/80 font-body">
                  Dejar dirigente <strong>pendiente</strong> (asignar después)
                </span>
              </label>
            )}
          </fieldset>

          {/* El co-dirigente va aparte, fuera del bloque del dirigente. */}
          {!pendingLeader && selectedLeader && (
            <div className="space-y-1">
              <label htmlFor="grupo-co-dirigente" className={cn(
                'text-[13px] tracking-widest uppercase font-display',
                esPremat ? 'text-coral' : 'text-navy-light/80',
              )}>
                {esPremat ? <>Co-dirigente <span aria-hidden>*</span></> : 'Co-dirigente (opcional)'}
              </label>
              {/* AUD-1 · `aria-label` acá no hacía nada: DirigentesCombobox no
                  la acepta como prop, así que se descartaba en silencio y el
                  campo quedaba sin nombre. Con inputId + htmlFor la asociación
                  es real y el nombre sale del texto visible. */}
              <DirigentesCombobox
                inputId="grupo-co-dirigente"
                value={selectedCoLeader || null}
                onChange={id => setSelectedCoLeader(id ?? '')}
                excludeId={selectedLeader || undefined}
                filter={filtroPremat}
                placeholder="Buscar co-dirigente…"
              />
              {esPremat && (
                <p className="text-[13px] text-navy-light/80 font-body">
                  El prematrimonial se da en pareja: hacen falta los dos.
                </p>
              )}
            </div>
          )}

          {/* Por qué no se puede seguir, visible antes de apretar. */}
          {errorPremat && (selectedLeader || pendingLeader) && (
            <p className="rounded-xl bg-coral/5 px-3 py-2 text-[13px] text-coral-deep font-body" role="alert">
              {errorPremat}
            </p>
          )}

          {/* Sede de envío de folletos: sedes ACTIVAS del catálogo, TBD por
              defecto, u "Otro" con detalle libre. */}
          <div className="space-y-1">
            <label htmlFor="folletos-sede" className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
              Sede a la que se envían los folletos
            </label>
            <select
              id="folletos-sede"
              value={folletosSedeSel}
              onChange={e => setFolletosSedeSel(e.target.value)}
              className={inputCls}
            >
              <option value="TBD">TBD (por definir)</option>
              {ACTIVE_SEDES.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              <option value="__otro__">Otro…</option>
            </select>
            {folletosSedeSel === '__otro__' && (
              <input
                value={folletosSedeOtro}
                onChange={e => setFolletosSedeOtro(e.target.value)}
                placeholder="Detalle de la entrega (lugar, persona, indicaciones)"
                aria-label="Detalle de la sede de folletos"
                className={cn(inputCls, 'mt-1 placeholder:text-navy-light/80')}
              />
            )}
          </div>

          {leaderHint && (
            <p className="text-[13px] text-navy-light/80 text-right font-body" role="status">
              Para continuar, {leaderHint}.
            </p>
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
              disabled={!puedeAvanzarDirigente}
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
            className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
          >
            Paso 3 — Confirmación
          </h2>

          <div className="rounded-xl p-4 space-y-3 bg-surface-low">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display">Tipo</p>
                <StudyTypeBadge code={studyType?.code ?? ''} name={studyType?.name} size="sm" />
              </div>
              <div>
                <p className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display">Zona</p>
                <p className="text-navy font-body">{zoneSel.kind === 'empty' ? '—' : zoneSel.label}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display">Día</p>
                <p className="text-navy font-body">{step1.days.length > 0 ? step1.days.map(d => DAY_LABELS[d]).join(', ') : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display">Horario</p>
                <p className="text-navy font-body">{step1.time || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display">Dirigente</p>
                <p className="text-navy font-body">{leaderData?.member_name ?? (pendingLeader ? 'Pendiente' : '—')}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display">Inicio estimado</p>
                <p className="text-navy font-body">{step1.start_date || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display">Capacidad</p>
                <p className="text-navy font-body">{step1.capacity} personas</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display">Modalidad</p>
                <p className="text-navy font-body">{step1.is_virtual ? 'Virtual' : 'Presencial'}</p>
              </div>
              <div>
                <label className="text-[11px] uppercase text-navy-light/80 mb-0.5 font-display block" htmlFor="nuevo-grupo-estado">Estado inicial</label>
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

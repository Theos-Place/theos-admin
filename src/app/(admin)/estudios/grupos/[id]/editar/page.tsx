'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import { useToast } from '@/components/shared/Toast'
import { sedeLabel, useSedes } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { DirigentesCombobox } from '@/components/shared/DirigentesCombobox'
import { Combobox, type ComboValue } from '@/components/shared/Combobox'
import { resolveZoneCode } from '@/lib/zones'
import { zoneOnVirtualToggle } from '@/lib/studies/virtual-zone'
import { toYmdLocal } from '@/lib/format'
import { cn } from '@/lib/utils'
import { minEnrollmentEnd, maxEnrollmentEnd } from '@/lib/studies/enrollment-window'
import { ChevronLeft } from 'lucide-react'
import type { StudyType, StudyGroup, GroupStatus } from '@/types/study'
import { AudienceRestrictionSection } from '@/components/studies/AudienceRestrictionSection'
import { normalizeRestriction, type GroupRestriction } from '@/lib/studies/group-restrictions'

const STATUS_OPTIONS: Array<{ value: GroupStatus; label: string }> = [
  { value: 'en_matricula', label: 'En matrícula' },
  { value: 'en_curso',     label: 'En curso' },
  { value: 'finalizado',   label: 'Finalizado' },
]

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_LABELS: Record<string, string> = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo',
}
const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[11px] text-navy-light/60 font-display'

export default function EditarGrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { groups, studyTypes, loading, refetch } = useStudies('plans', 'groups')

  // El form se monta solo cuando el grupo ya cargó: los useState del form se
  // inicializan una única vez, así que montar antes dejaría los campos vacíos
  // y al guardar se pisarían los datos reales del grupo.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
      </div>
    )
  }

  const group = groups.find(g => g.id === id)
  if (!group) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/grupos" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Grupos
        </Link>
        <p className="text-navy-light/60 font-body">Grupo no encontrado.</p>
      </div>
    )
  }

  const studyType = studyTypes.find(s => s.id === group.study_type_id) ?? null
  return <EditarForm group={group} studyType={studyType} refetch={refetch} />
}

function EditarForm({ group, studyType, refetch }: {
  group: StudyGroup
  studyType: StudyType | null
  refetch: () => Promise<void>
}) {
  const router = useRouter()
  const toast = useToast()
  const { zoneSedes: SEDES } = useSedes()

  const [zone, setZone] = useState<ComboValue>(
    group.zone ? { kind: 'existing', value: group.zone, label: sedeLabel(group.zone) } : { kind: 'empty' },
  )
  const [days, setDays] = useState<string[]>(group.schedule_days ?? [])
  const [time, setTime] = useState(group.schedule_time ?? '')
  const [location, setLocation] = useState(group.location ?? '')
  const [capacity, setCapacity] = useState(group.max_capacity ? String(group.max_capacity) : '')
  const [ageMin, setAgeMin] = useState(group.age_min != null ? String(group.age_min) : '')
  const [ageMax, setAgeMax] = useState(group.age_max != null ? String(group.age_max) : '')
  const [startDate, setStartDate] = useState(group.start_date?.slice(0, 10) ?? '')
  const [endDate, setEndDate] = useState(group.end_date?.slice(0, 10) ?? '')
  // GRU-1: ventana de matrícula (vacías = modo manual).
  const [enrollStart, setEnrollStart] = useState(group.enrollment_start_date ?? '')
  const [enrollEnd, setEnrollEnd] = useState(group.enrollment_end_date ?? '')
  const [leaderId, setLeaderId] = useState(group.leader_id ?? '')
  const [coLeaderId, setCoLeaderId] = useState(group.co_leader_id ?? '')
  const [waUrl, setWaUrl] = useState(group.whatsapp_group_url ?? '')
  const [status, setStatus] = useState<GroupStatus>(group.status)
  const [isVirtual, setIsVirtual] = useState(group.is_virtual ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // GRU-2: la restricción no viaja en el listado de grupos (solo el flag
  // has_restriction), así que el detalle se pide acá al abrir la edición.
  const [restriction, setRestriction] = useState<GroupRestriction | null>(null)
  const [restrictionLoaded, setRestrictionLoaded] = useState(!group.has_restriction)
  useEffect(() => {
    if (!group.has_restriction) return
    let vivo = true
    fetch(`/api/studies/groups/${group.id}/restriction`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivo) setRestriction(normalizeRestriction(d?.restriction)) })
      .catch(() => { /* sin restricción cargada: no se pisa al guardar */ })
      .finally(() => { if (vivo) setRestrictionLoaded(true) })
    return () => { vivo = false }
  }, [group.id, group.has_restriction])

  // Un grupo tiene un único día: seleccionar reemplaza; volver a tocar el
  // mismo lo quita. Se guarda igual como array (schedule_days) con 0 o 1 día.
  function toggleDay(d: string) {
    setDays(prev => (prev.includes(d) ? [] : [d]))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const zoneCode = await resolveZoneCode(zone)
      const res = await fetch(`/api/studies/groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leader_id: leaderId || null,
          co_leader_id: coLeaderId || null,
          zone: zoneCode,
          schedule_days: days,
          schedule_time: time || null,
          location: location || null,
          max_students: capacity ? Number(capacity) : null,
          age_min: ageMin ? Number(ageMin) : null,
          age_max: ageMax ? Number(ageMax) : null,
          starts_at: startDate || null,
          ends_at: endDate || null,
          enrollment_start_date: enrollStart || null,
          enrollment_end_date: enrollEnd || null,
          whatsapp_group_url: waUrl || null,
          status,
          is_virtual: isVirtual,
          // Si la restricción no terminó de cargar, NO se manda: mejor no tocar
          // la columna que borrarla sin querer.
          ...(restrictionLoaded ? { enrollment_restrictions: restriction } : {}),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Error guardando el grupo (${res.status})`)
      }
      await refetch()
      toast('Cambios guardados', 'success')
      router.push(`/estudios/grupos/${group.id}`)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Revisá los datos e intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/estudios/grupos/${group.id}`}
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Volver al grupo
      </Link>

      <div className="flex items-center gap-3">
        <StudyTypeBadge code={group.study_type_id} name={studyType?.name} size="md" />
        <div>
          <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
            Editar grupo
          </h1>
          <p className="text-sm text-navy-light/60 font-body">
            {studyType?.name ?? group.study_type_id} · {sedeLabel(group.zone)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="grid grid-cols-2 gap-4">
          {/* Dirigente en su propio bloque y el co-dirigente aparte, igual que
              en el alta de un grupo: sin la agrupación, no se ve a cuál de los
              dos campos pertenece cada cosa (bug 2026-08-04). */}
          <fieldset className="col-span-2 sm:col-span-1 rounded-xl border border-[var(--outline-variant)] bg-surface-low/60 p-4 space-y-1">
            <legend className={`px-1 ${labelCls}`}>Dirigente</legend>
            <DirigentesCombobox
              value={leaderId || null}
              onChange={id => setLeaderId(id ?? '')}
              excludeId={coLeaderId || undefined}
              placeholder="Buscar dirigente…"
              aria-label="Buscar dirigente"
            />
          </fieldset>

          <div className="col-span-2 sm:col-span-1 space-y-1 sm:pt-4">
            <label className={labelCls}>Co-dirigente (opcional)</label>
            <DirigentesCombobox
              value={coLeaderId || null}
              onChange={id => setCoLeaderId(id ?? '')}
              excludeId={leaderId || undefined}
              placeholder="Buscar co-dirigente…"
              aria-label="Buscar co-dirigente"
            />
          </div>

          {/* Estado */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls} htmlFor="editar-grupo-estado">Estado</label>
            <select
              id="editar-grupo-estado"
              className={inputCls}
              value={status}
              onChange={e => setStatus(e.target.value as GroupStatus)}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-navy-light/60 font-body">
              Para el cierre formal (calificaciones y promoción) usá la página de cierre del grupo.
            </p>
          </div>

          {/* Zona */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls}>Zona</label>
            {isVirtual ? (
              // EST-4: en grupos virtuales la zona queda fija en "Virtual".
              <p className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy-light/60 font-body" aria-label="Zona fijada: Virtual">
                Virtual (fijada por ser grupo virtual)
              </p>
            ) : (
              <Combobox
                ariaLabel="Zona"
                items={SEDES.map(s => ({ value: s.id, label: s.name }))}
                value={zone}
                onChange={setZone}
                allowEmpty
                emptyLabel="Sin zona"
                allowCreate={false}
                placeholder="Buscar zona…"
              />
            )}
          </div>

          {/* Día */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls}>Día</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-all',
                    days.includes(d) ? 'bg-navy text-white border-navy' : 'text-navy-light hover:bg-surface-low',
                    'border-[var(--outline-variant)] font-display',
                  )}
                >
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Capacidad + Horario: mitad y mitad. */}
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls}>Capacidad máxima</label>
              <input type="number" min={1} className={inputCls} value={capacity} onChange={e => setCapacity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Horario</label>
              <input className={inputCls} placeholder="7:30pm" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          {/* Rango de edad (opcional): filtra a quién se le ofrece en matrícula. Mitad y mitad. */}
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls}>Edad desde</label>
              <input type="number" min={0} className={inputCls} placeholder="Sin mínimo" value={ageMin} onChange={e => setAgeMin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Edad hasta</label>
              <input type="number" min={0} className={inputCls} placeholder="Sin máximo" value={ageMax} onChange={e => setAgeMax(e.target.value)} />
            </div>
          </div>

          {/* Ubicación */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls}>Ubicación</label>
            <input className={inputCls} placeholder="Edificio Meridiano, Escazú" value={location} onChange={e => setLocation(e.target.value)} />
          </div>

          {/* Modalidad virtual */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-coral"
                checked={isVirtual}
                onChange={e => {
                  // EST-4: virtual fija la zona "Virtual"; desmarcar la limpia.
                  setIsVirtual(e.target.checked)
                  setZone(prev => zoneOnVirtualToggle(e.target.checked, prev, { kind: 'empty' }))
                }}
              />
              <span className="text-sm text-navy-light/70 font-body">
                Grupo <strong>virtual</strong> (solo lo ven miembros autorizados para estudios virtuales)
              </span>
            </label>
          </div>

          {/* Fechas */}
          <div className="space-y-1">
            <label className={labelCls}>Fecha de inicio</label>
            <input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Fecha de cierre</label>
            <input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          {/* GRU-1: ventana de matrícula (vacías = modo manual). */}
          <div className="space-y-1">
            <label className={labelCls}>Inicio de matrícula</label>
            <input type="date" className={inputCls} value={enrollStart} max={enrollEnd || undefined} onChange={e => setEnrollStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Fin de matrícula</label>
            <input type="date" className={inputCls} value={enrollEnd} min={minEnrollmentEnd(enrollStart, toYmdLocal(new Date()))} max={maxEnrollmentEnd(startDate, toYmdLocal(new Date()))} onChange={e => setEnrollEnd(e.target.value)} />
          </div>

          {/* WhatsApp */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls}>Enlace de grupo de WhatsApp</label>
            <input className={inputCls} placeholder="https://chat.whatsapp.com/..." value={waUrl} onChange={e => setWaUrl(e.target.value)} />
          </div>
        </div>

        {/* GRU-2 · A quién se le ofrece este grupo (opcional). */}
        {restrictionLoaded && (
          <AudienceRestrictionSection
            value={restriction}
            onChange={setRestriction}
            defaultOpen={!!group.has_restriction}
          />
        )}

        {error && <p className="text-sm text-coral font-body">{error}</p>}

        <div className="flex justify-between pt-2">
          <Link
            href={`/estudios/grupos/${group.id}`}
            className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            Cancelar
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

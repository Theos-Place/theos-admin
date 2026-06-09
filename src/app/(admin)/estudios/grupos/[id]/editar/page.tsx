'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import { sedeLabel, useSedes } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { DirigentesCombobox } from '@/components/shared/DirigentesCombobox'
import { cn } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_LABELS: Record<string, string> = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo',
}
const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[11px] text-navy-light/60 font-display'

export default function EditarGrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { activeSedes: SEDES } = useSedes()
  const { groups, studyTypes, refetch } = useStudies()
  const group = groups.find(g => g.id === id)
  const studyType = studyTypes.find(s => s.id === group?.study_type_id) ?? null

  const [zone, setZone] = useState(group?.zone ?? '')
  const [days, setDays] = useState<string[]>(group?.schedule_days ?? [])
  const [time, setTime] = useState(group?.schedule_time ?? '')
  const [location, setLocation] = useState(group?.location ?? '')
  const [capacity, setCapacity] = useState(String(group?.max_capacity ?? '10'))
  const [startDate, setStartDate] = useState(group?.start_date?.slice(0, 10) ?? '')
  const [endDate, setEndDate] = useState(group?.end_date?.slice(0, 10) ?? '')
  const [leaderId, setLeaderId] = useState('')
  const [coLeaderId, setCoLeaderId] = useState('')
  const [waUrl, setWaUrl] = useState(group?.whatsapp_group_url ?? '')
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hidrata los selectores con el dirigente/co-dirigente actuales (member_id).
  if (!hydrated && group) {
    setLeaderId(group.leader_id ?? '')
    setCoLeaderId(group.co_leader_id ?? '')
    setHydrated(true)
  }

  function toggleDay(d: string) {
    setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))
  }

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

  const leaderMemberId = leaderId || null
  const coLeaderMemberId = coLeaderId || null

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/studies/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leader_id: leaderMemberId,
          co_leader_id: coLeaderMemberId,
          zone: zone || null,
          schedule_days: days,
          schedule_time: time || null,
          location: location || null,
          max_students: capacity ? Number(capacity) : null,
          starts_at: startDate || null,
          ends_at: endDate || null,
          whatsapp_group_url: waUrl || null,
        }),
      })
      if (!res.ok) throw new Error('Error guardando el grupo')
      await refetch()
      router.push(`/estudios/grupos/${id}`)
    } catch (e) {
      console.error(e)
      setError('No se pudo guardar. Revisá los datos e intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/estudios/grupos/${id}`}
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
          {/* Dirigente */}
          <div className="space-y-1">
            <label className={labelCls}>Dirigente</label>
            <DirigentesCombobox
              value={leaderId || null}
              onChange={id => setLeaderId(id ?? '')}
              excludeId={coLeaderId || undefined}
              placeholder="Buscar dirigente…"
            />
          </div>

          {/* Co-dirigente */}
          <div className="space-y-1">
            <label className={labelCls}>Co-dirigente</label>
            <DirigentesCombobox
              value={coLeaderId || null}
              onChange={id => setCoLeaderId(id ?? '')}
              excludeId={leaderId || undefined}
              placeholder="Buscar co-dirigente…"
            />
          </div>

          {/* Zona */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls}>Zona</label>
            <select className={inputCls} value={zone} onChange={e => setZone(e.target.value)}>
              <option value="">Sin zona</option>
              {SEDES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Días */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls}>Días</label>
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

          {/* Horario */}
          <div className="space-y-1">
            <label className={labelCls}>Horario</label>
            <input className={inputCls} placeholder="7:30pm" value={time} onChange={e => setTime(e.target.value)} />
          </div>

          {/* Capacidad */}
          <div className="space-y-1">
            <label className={labelCls}>Capacidad máxima</label>
            <input type="number" min={1} className={inputCls} value={capacity} onChange={e => setCapacity(e.target.value)} />
          </div>

          {/* Ubicación */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls}>Ubicación</label>
            <input className={inputCls} placeholder="Edificio Meridiano, Escazú" value={location} onChange={e => setLocation(e.target.value)} />
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

          {/* WhatsApp */}
          <div className="col-span-2 space-y-1">
            <label className={labelCls}>Enlace de grupo de WhatsApp</label>
            <input className={inputCls} placeholder="https://chat.whatsapp.com/..." value={waUrl} onChange={e => setWaUrl(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-coral font-body">{error}</p>}

        <div className="flex justify-between pt-2">
          <Link
            href={`/estudios/grupos/${id}`}
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

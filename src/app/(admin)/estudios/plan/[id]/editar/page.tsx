'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { STUDY_CATALOG } from '@/data/study-catalog'
import { STUDY_TYPES } from '@/data/mock-studies'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

function Toggle({ checked, onChange, label, sublabel }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sublabel?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{label}</p>
        {sublabel && <p className="text-[11px] text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>{sublabel}</p>}
      </div>
      <label
        className="toggle shrink-0"
        style={{ cursor: 'pointer' }}
      >
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="toggle-track" />
      </label>
    </div>
  )
}

export default function EditarEstudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: code } = use(params)
  const router = useRouter()

  const catalogEntry = STUDY_CATALOG.find(s => s.code === code)
  const typeEntry    = STUDY_TYPES.find(s => s.code === code)

  const [form, setForm] = useState({
    name:             catalogEntry?.name         ?? '',
    weeks:            catalogEntry?.weeks        ?? 0,
    mentor:           catalogEntry?.mentor        ?? '',
    description:      catalogEntry?.description  ?? '',
    commitments:      catalogEntry?.commitments  ?? '',
    level:            catalogEntry?.level        ?? '',
    requires_payment: typeEntry?.requires_payment ?? false,
    cost:             typeEntry?.cost             ?? 0,
    req_donor:        typeEntry?.req_donor        ?? false,
    req_server:       typeEntry?.req_server       ?? false,
    req_attendee:     typeEntry?.req_attendee     ?? false,
    requires_grade:   typeEntry?.requires_grade   ?? false,
    auto_promote:     typeEntry?.auto_promote     ?? false,
    is_archived:      typeEntry?.is_archived      ?? false,
  })

  if (!catalogEntry) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/plan" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Plan de Estudios
        </Link>
        <p className="text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>Estudio no encontrado.</p>
      </div>
    )
  }

  function handleSave() {
    if (!catalogEntry) return

    Object.assign(catalogEntry, {
      name:        form.name,
      weeks:       form.weeks,
      mentor:      form.mentor,
      description: form.description,
      commitments: form.commitments,
      level:       form.level || undefined,
    })
    if (typeEntry) {
      Object.assign(typeEntry, {
        requires_payment: form.requires_payment,
        cost:             form.cost,
        req_donor:        form.req_donor,
        req_server:       form.req_server,
        req_attendee:     form.req_attendee,
        requires_grade:   form.requires_grade,
        auto_promote:     form.auto_promote,
        is_archived:      form.is_archived,
      })
    }
    router.push('/estudios/plan')
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(p => ({ ...p, [key]: value }))

  const stageLabel = catalogEntry.stage === 'niveles' ? 'Niveles'
    : catalogEntry.stage === 'inicial'    ? 'Inicial'
    : catalogEntry.stage === 'campaña'    ? 'Campaña'
    : 'Intermedia'

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <Link
        href="/estudios/plan"
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronLeft size={16} /> Plan de Estudios
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Editar estudio
          </h1>
          <p className="mt-0.5 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            {catalogEntry.code} · {stageLabel}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => router.back()}
            className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Guardar cambios
          </button>
        </div>
      </div>

      {/* Información básica */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <h2 className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Información básica
        </h2>

        {/* Nombre */}
        <div className="space-y-1">
          <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>
            Nombre del estudio *
          </label>
          <input
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        {/* Duración + Nivel */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>
              Duración (semanas)
            </label>
            <input
              type="number"
              min={1}
              max={52}
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={form.weeks}
              onChange={e => set('weeks', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>
              Nivel
            </label>
            <select
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={form.level}
              onChange={e => set('level', e.target.value)}
            >
              <option value="">Sin nivel</option>
              <option value="Básico">Básico</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>
          </div>
        </div>

        {/* Mentor */}
        <div className="space-y-1">
          <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>
            Mentor
          </label>
          <input
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="Nombre del mentor..."
            value={form.mentor}
            onChange={e => set('mentor', e.target.value)}
          />
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>
            Descripción pública
          </label>
          <textarea
            className={cn(inputCls, 'resize-none')}
            style={{ fontFamily: 'var(--font-body)', minHeight: 120 }}
            placeholder="Descripción visible para los miembros..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {/* Compromisos */}
        <div className="space-y-1">
          <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>
            Compromisos requeridos
          </label>
          <input
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="ej. Tareas semanales, examen final..."
            value={form.commitments}
            onChange={e => set('commitments', e.target.value)}
          />
        </div>
      </div>

      {/* Configuración */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <h2 className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Configuración
        </h2>

        <Toggle
          checked={form.requires_payment}
          onChange={v => set('requires_payment', v)}
          label="¿Requiere pago?"
        />
        {form.requires_payment && (
          <div className="ml-4 space-y-1">
            <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>Monto (₡)</label>
            <input
              type="number"
              className={cn(inputCls, 'max-w-xs')}
              style={{ fontFamily: 'var(--font-body)' }}
              value={form.cost}
              onChange={e => set('cost', Number(e.target.value))}
            />
          </div>
        )}

        <Toggle checked={form.req_donor}      onChange={v => set('req_donor', v)}      label="Requiere ser donador" />
        <Toggle checked={form.req_server}     onChange={v => set('req_server', v)}     label="Requiere servir en un comité" />
        <Toggle checked={form.req_attendee}   onChange={v => set('req_attendee', v)}   label="Requiere asistencia regular a charlas" />
        <Toggle checked={form.requires_grade} onChange={v => set('requires_grade', v)} label="Requiere calificación numérica" />
        <Toggle
          checked={form.auto_promote}
          onChange={v => set('auto_promote', v)}
          label="Transición automática al siguiente nivel"
          sublabel="Al cerrar el grupo, pasar automáticamente al siguiente estudio"
        />
        <Toggle
          checked={form.is_archived}
          onChange={v => set('is_archived', v)}
          label="Archivar estudio"
          sublabel="No estará disponible para nuevos grupos"
        />
      </div>

      {/* Footer actions */}
      <div className="flex gap-3 pb-6">
        <button
          onClick={handleSave}
          className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Guardar cambios
        </button>
        <button
          onClick={() => router.back()}
          className="rounded-xl border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

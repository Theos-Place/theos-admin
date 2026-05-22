'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { STUDY_CATALOG } from '@/data/study-catalog'
import { STUDY_TYPES, MOCK_LEADERS } from '@/data/mock-studies'
import { cn } from '@/lib/utils'

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
      <div className="page">
        <div className="ph">
          <div className="ptitle">Editar estudio</div>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <p className="text-sm text-navy-light/50 text-center py-8" style={{ fontFamily: 'var(--font-body)' }}>
            Estudio no encontrado.
          </p>
        </div>
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

  const qualifiedLeaders = MOCK_LEADERS.filter(
    l => l.is_active && l.qualified_studies.includes(code)
  )

  return (
    <div className="page">

      {/* Header */}
      <div className="ph">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.back()}
          style={{ marginBottom: 10 }}
        >
          ← Volver
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">Editar estudio</div>
            <div className="psub">{catalogEntry.code} · {stageLabel}</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost" onClick={() => router.back()}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Guardar cambios
            </button>
          </div>
        </div>
      </div>

      {/* Información básica */}
      <div className="card">
          <div className="card-hd">
            <div className="card-title">Información básica</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Nombre */}
            <div className="form-group">
              <label className="form-label">Nombre del estudio *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>

            {/* Duración + Nivel */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duración (semanas)</label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  className="form-input"
                  value={form.weeks}
                  onChange={e => set('weeks', Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nivel</label>
                <select
                  className="form-select"
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
            <div className="form-group">
              <label className="form-label">Mentor</label>
              <select
                className="form-select"
                value={form.mentor}
                onChange={e => set('mentor', e.target.value)}
              >
                <option value="">Sin asignar</option>
                {qualifiedLeaders.map(l => (
                  <option key={l.id} value={l.member_name}>{l.member_name}</option>
                ))}
              </select>
              {qualifiedLeaders.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3, fontFamily: 'var(--font-body)' }}>
                  No hay dirigentes calificados para este estudio
                </span>
              )}
            </div>

            {/* Descripción */}
            <div className="form-group">
              <label className="form-label">Descripción pública</label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Descripción visible para los miembros..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>

            {/* Compromisos */}
            <div className="form-group">
              <label className="form-label">Compromisos requeridos</label>
              <input
                className="form-input"
                placeholder="ej. Tareas semanales, examen final..."
                value={form.commitments}
                onChange={e => set('commitments', e.target.value)}
              />
            </div>
          </div>
      </div>

      {/* Configuración */}
      <div className="card">
          <div className="card-hd">
            <div className="card-title">Configuración</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <Toggle
          checked={form.requires_payment}
          onChange={v => set('requires_payment', v)}
          label="¿Requiere pago?"
        />
        {form.requires_payment && (
          <div className="form-group" style={{ paddingLeft: 16, maxWidth: 220 }}>
            <label className="form-label">Monto (₡)</label>
            <input
              type="number"
              className="form-input"
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
      </div>

    </div>
  )
}

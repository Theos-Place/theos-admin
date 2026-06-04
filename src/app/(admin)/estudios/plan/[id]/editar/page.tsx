'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import type { StudyType, StudyLeader } from '@/types/study'

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
      <label className="toggle shrink-0" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="toggle-track" />
      </label>
    </div>
  )
}

const STAGE_LABEL: Record<StudyType['stage'], string> = {
  niveles: 'Niveles', inicial: 'Inicial', intermedia: 'Intermedia', campaña: 'Campaña',
}

export default function EditarEstudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: code } = use(params)
  const { studyTypes, leaders, loading } = useStudies()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
      </div>
    )
  }

  const studyType = studyTypes.find(s => s.code === code)
  if (!studyType) {
    return (
      <div className="page">
        <div className="ph"><div className="ptitle">Editar estudio</div></div>
        <div className="card" style={{ padding: 22 }}>
          <p className="text-sm text-navy-light/50 text-center py-8" style={{ fontFamily: 'var(--font-body)' }}>
            Estudio no encontrado.
          </p>
        </div>
      </div>
    )
  }

  return <EditarForm studyType={studyType} leaders={leaders} />
}

function EditarForm({ studyType, leaders }: { studyType: StudyType; leaders: StudyLeader[] }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name:             studyType.name,
    weeks:            studyType.weeks,
    mentor_id:        studyType.mentor_id ?? '',
    description:      studyType.description ?? '',
    commitments:      studyType.commitments ?? '',
    difficulty:       studyType.difficulty ?? '',
    requires_payment: studyType.requires_payment,
    cost:             studyType.cost,
    req_donor:        studyType.req_donor,
    req_server:       studyType.req_server,
    req_attendee:     studyType.req_attendee,
    requires_grade:   studyType.requires_grade,
    auto_promote:     studyType.auto_promote,
    is_archived:      studyType.is_archived,
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(p => ({ ...p, [key]: value }))

  async function handleSave() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/studies/plans/${studyType.plan_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          duration_weeks: form.weeks || null,
          mentor_id: form.mentor_id || null,
          description: form.description || null,
          commitments: form.commitments || null,
          difficulty: form.difficulty || null,
          requires_payment: form.requires_payment,
          cost: form.requires_payment ? form.cost : 0,
          requires_donor: form.req_donor,
          requires_server: form.req_server,
          requires_attendance: form.req_attendee,
          requires_grade: form.requires_grade,
          auto_promote: form.auto_promote,
          is_active: !form.is_archived,
        }),
      })
      if (!res.ok) throw new Error('Error guardando los cambios')
      router.push('/estudios/plan')
      router.refresh()
    } catch (e) {
      console.error(e)
      alert('No se pudieron guardar los cambios. Intentá de nuevo.')
      setSubmitting(false)
    }
  }

  const qualifiedLeaders = leaders.filter(
    l => l.is_active && l.qualified_studies.includes(studyType.code)
  )

  return (
    <div className="page">

      {/* Header */}
      <div className="ph">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ marginBottom: 10 }}>
          ← Volver
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">Editar estudio</div>
            <div className="psub">{studyType.code} · {STAGE_LABEL[studyType.stage]}</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost" onClick={() => router.back()} disabled={submitting}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* Información básica */}
      <div className="card">
        <div className="card-hd"><div className="card-title">Información básica</div></div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-study-name">Nombre del estudio *</label>
            <input id="edit-study-name" className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-study-weeks">Duración (semanas)</label>
              <input id="edit-study-weeks" type="number" min={1} max={52} className="form-input" value={form.weeks} onChange={e => set('weeks', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-study-difficulty">Dificultad</label>
              <select id="edit-study-difficulty" className="form-select" value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
                <option value="">Sin dificultad</option>
                <option value="Básico">Básico</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-study-mentor">Mentor</label>
            <select id="edit-study-mentor" className="form-select" value={form.mentor_id} onChange={e => set('mentor_id', e.target.value)}>
              <option value="">Sin asignar</option>
              {qualifiedLeaders.map(l => (
                <option key={l.id} value={l.member_id}>{l.member_name}</option>
              ))}
            </select>
            {qualifiedLeaders.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3, fontFamily: 'var(--font-body)' }}>
                No hay dirigentes calificados para este estudio
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-study-description">Descripción pública</label>
            <textarea id="edit-study-description" className="form-textarea" rows={4} placeholder="Descripción visible para los miembros..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-study-commitments">Compromisos requeridos</label>
            <input id="edit-study-commitments" className="form-input" placeholder="ej. Tareas semanales, examen final..." value={form.commitments} onChange={e => set('commitments', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Configuración */}
      <div className="card">
        <div className="card-hd"><div className="card-title">Configuración</div></div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Toggle checked={form.requires_payment} onChange={v => set('requires_payment', v)} label="¿Requiere pago?" />
          {form.requires_payment && (
            <div className="form-group" style={{ paddingLeft: 16, maxWidth: 220 }}>
              <label className="form-label" htmlFor="edit-study-cost">Monto (₡)</label>
              <input id="edit-study-cost" type="number" className="form-input" value={form.cost} onChange={e => set('cost', Number(e.target.value))} />
            </div>
          )}

          <Toggle checked={form.req_donor}      onChange={v => set('req_donor', v)}      label="Requiere ser donador" />
          <Toggle checked={form.req_server}     onChange={v => set('req_server', v)}     label="Requiere servir en un comité" />
          <Toggle checked={form.req_attendee}   onChange={v => set('req_attendee', v)}   label="Requiere asistencia regular a charlas" />
          <Toggle checked={form.requires_grade} onChange={v => set('requires_grade', v)} label="Requiere calificación numérica" />
          <Toggle checked={form.auto_promote}   onChange={v => set('auto_promote', v)}   label="Transición automática al siguiente nivel" sublabel="Al cerrar el grupo, pasar automáticamente al siguiente estudio" />
          <Toggle checked={form.is_archived}    onChange={v => set('is_archived', v)}    label="Archivar estudio" sublabel="No estará disponible para nuevos grupos" />
        </div>
      </div>

    </div>
  )
}

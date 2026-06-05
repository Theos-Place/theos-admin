'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useServers } from '@/hooks/useServers'
import { Check } from 'lucide-react'

export default function EditarVacantePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { vacancies, loading } = useServers()
  const vacancy = useMemo(() => vacancies.find(v => v.id === id), [vacancies, id])

  const [title, setTitle]           = useState('')
  const [position, setPosition]     = useState('')
  const [description, setDescription] = useState('')
  const [schedule, setSchedule]     = useState('')
  const [commitment, setCommitment] = useState('')
  const [slotsTotal, setSlotsTotal] = useState('1')
  const [functions, setFunctions]   = useState<string[]>([''])
  const [saved, setSaved]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Poblar el form cuando la vacante llega de la BD (carga async).
  useEffect(() => {
    if (!vacancy) return
    setTitle(vacancy.title)
    setPosition(vacancy.position)
    setDescription(vacancy.description)
    setSchedule(vacancy.schedule)
    setCommitment(vacancy.commitment)
    setSlotsTotal(String(vacancy.slots_total))
    setFunctions(vacancy.functions.length ? vacancy.functions : [''])
  }, [vacancy])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/servers/vacancies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          position: position.trim() || null,
          description: description.trim() || null,
          schedule: schedule.trim() || null,
          commitment: commitment.trim() || null,
          slots_total: Math.max(1, Number(slotsTotal) || 1),
          functions: functions.map(f => f.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error('No se pudieron guardar los cambios')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !vacancy) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Cargando puesto...
        </p>
      </div>
    )
  }

  if (!vacancy) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Puesto no encontrado.
        </p>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Cambios guardados
          </p>
          <button
            onClick={() => router.push(`/servidores/vacantes/${id}`)}
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Ver puesto
          </button>
        </div>
      </div>
    )
  }

  const inputCls = 'form-input'

  function updateFunction(idx: number, value: string) {
    setFunctions(prev => prev.map((f, i) => i === idx ? value : f))
  }
  function addFunction() { setFunctions(prev => [...prev, '']) }
  function removeFunction(idx: number) { setFunctions(prev => prev.filter((_, i) => i !== idx)) }

  return (
    <div className="page">
      {/* Header */}
      <div className="ph">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/servidores/vacantes/${id}`)} style={{ marginBottom: 10 }}>
          ← Volver al puesto
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">Editar puesto</div>
            <div className="psub">{vacancy.committee_name}</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/servidores/vacantes/${id}`)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-coral" style={{ fontFamily: 'var(--font-body)', marginBottom: 8 }}>
          {error}
        </p>
      )}

      {/* Form card */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Título del puesto</label>
              <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Colaborador de Alabanza" />
            </div>
            <div className="form-group">
              <label className="form-label">Puesto</label>
              <input className={inputCls} value={position} onChange={e => setPosition(e.target.value)} placeholder="Ej. Músico voluntario" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-textarea" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del rol..." />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Horario</label>
              <input className={inputCls} value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="Ej. Domingos 8am – 12pm" />
            </div>
            <div className="form-group">
              <label className="form-label">Compromiso</label>
              <input className={inputCls} value={commitment} onChange={e => setCommitment(e.target.value)} placeholder="Ej. 4 horas semanales" />
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: 160 }}>
            <label className="form-label">Cupos disponibles</label>
            <input type="number" min="1" max="50" className={inputCls} value={slotsTotal} onChange={e => setSlotsTotal(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Funciones principales</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {functions.map((fn, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8 }}>
                  <input
                    className={inputCls}
                    value={fn}
                    onChange={e => updateFunction(idx, e.target.value)}
                    placeholder={`Función ${idx + 1}...`}
                  />
                  {functions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFunction(idx)}
                      className="shrink-0 rounded-xl border px-3 text-navy-light/50 hover:text-coral hover:border-coral/20 transition-colors"
                      style={{ borderColor: 'var(--outline-variant)' }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addFunction}
                className="self-start rounded-full border px-4 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                + Agregar función
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

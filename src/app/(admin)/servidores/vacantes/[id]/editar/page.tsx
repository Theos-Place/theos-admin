'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useServers } from '@/hooks/useServers'
import { useToast } from '@/components/shared/Toast'
import { Check } from 'lucide-react'

export default function EditarVacantePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { vacancies, loading } = useServers()
  const toast = useToast()
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
      toast('Cambios guardados', 'success')
      setSaved(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !vacancy) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/60 font-body">
          Cargando puesto...
        </p>
      </div>
    )
  }

  if (!vacancy) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/60 font-body">
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
          <p className="text-xl font-bold text-navy font-display">
            Cambios guardados
          </p>
          <button
            onClick={() => router.push(`/servidores/vacantes/${id}`)}
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
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
        <button className="btn btn-ghost btn-sm mb-[10px]" onClick={() => router.push(`/servidores/vacantes/${id}`)}>
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
        <p className="text-sm text-coral font-body mb-2">
          {error}
        </p>
      )}

      {/* Form card */}
      <div className="card py-5 px-[22px]">
        <div className="flex flex-col gap-4">

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Título del puesto</label>
              <input aria-label="Título del puesto" className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Colaborador de Alabanza" />
            </div>
            <div className="form-group">
              <label className="form-label">Puesto</label>
              <input aria-label="Puesto" className={inputCls} value={position} onChange={e => setPosition(e.target.value)} placeholder="Ej. Músico voluntario" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea aria-label="Descripción" className="form-textarea" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del rol..." />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Horario</label>
              <input aria-label="Horario" className={inputCls} value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="Ej. Domingos 8am – 12pm" />
            </div>
            <div className="form-group">
              <label className="form-label">Compromiso</label>
              <input aria-label="Compromiso" className={inputCls} value={commitment} onChange={e => setCommitment(e.target.value)} placeholder="Ej. 4 horas semanales" />
            </div>
          </div>

          <div className="form-group max-w-40">
            <label className="form-label">Cupos disponibles</label>
            <input type="number" min="1" max="50" aria-label="Cupos disponibles" className={inputCls} value={slotsTotal} onChange={e => setSlotsTotal(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Funciones principales</label>
            <div className="flex flex-col gap-2">
              {functions.map((fn, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    aria-label={`Función ${idx + 1}`}
                    className={inputCls}
                    value={fn}
                    onChange={e => updateFunction(idx, e.target.value)}
                    placeholder={`Función ${idx + 1}...`}
                  />
                  {functions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFunction(idx)}
                      aria-label={`Eliminar función ${idx + 1}`}
                      className="shrink-0 rounded-xl border border-[var(--outline-variant)] px-3 text-navy-light/60 hover:text-coral hover:border-coral/20 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addFunction}
                className="self-start rounded-full border border-[var(--outline-variant)] px-4 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
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

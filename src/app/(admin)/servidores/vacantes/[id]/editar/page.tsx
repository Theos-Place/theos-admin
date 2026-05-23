'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MOCK_VACANCIES } from '@/data/mock-servers'
import { Check } from 'lucide-react'

export default function EditarVacantePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const vacancy = useMemo(() => MOCK_VACANCIES.find(v => v.id === id), [id])

  const [title, setTitle]           = useState(vacancy?.title ?? '')
  const [position, setPosition]     = useState(vacancy?.position ?? '')
  const [description, setDescription] = useState(vacancy?.description ?? '')
  const [schedule, setSchedule]     = useState(vacancy?.schedule ?? '')
  const [commitment, setCommitment] = useState(vacancy?.commitment ?? '')
  const [slotsTotal, setSlotsTotal] = useState(String(vacancy?.slots_total ?? 1))
  const [functions, setFunctions]   = useState<string[]>(vacancy?.functions ?? [''])
  const [saved, setSaved]           = useState(false)

  if (!vacancy) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Vacante no encontrada.
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
            Ver vacante
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
          ← Volver a la vacante
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">Editar vacante</div>
            <div className="psub">{vacancy.committee_name}</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/servidores/vacantes/${id}`)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => setSaved(true)}>Guardar cambios</button>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Título de la vacante</label>
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

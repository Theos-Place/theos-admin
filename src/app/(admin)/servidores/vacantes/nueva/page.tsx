'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useServers } from '@/hooks/useServers'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

function NuevaVacanteContent() {
  const params = useSearchParams()
  const preselectedCommittee = params.get('comite') ?? ''
  const { committees } = useServers()
  const toast = useToast()

  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [published, setPublished] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Step 1 — solicitud interna
  const [committeeId, setCommitteeId] = useState(preselectedCommittee)
  const [positionId, setPositionId]   = useState('')
  const [slots, setSlots]             = useState('1')
  const [justification, setJustification] = useState('')

  // Step 2 — publicación
  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [functions, setFunctions] = useState<string[]>([''])
  const [schedule, setSchedule]   = useState('')
  const [commitment, setCommitment] = useState('')

  const selectedCommittee = committees.find(c => c.id === committeeId)
  const position = selectedCommittee?.positions?.find(p => p.id === positionId)?.title ?? ''

  async function handleSubmit(status: 'draft' | 'published') {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/servers/vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committee_id: committeeId,
          position_id: positionId || null,
          position,
          title: title.trim() || position,
          description: description.trim() || null,
          functions: functions.map(f => f.trim()).filter(Boolean),
          schedule: schedule.trim() || null,
          commitment: commitment.trim() || null,
          slots_total: Math.max(1, Number(slots) || 1),
          status,
        }),
      })
      if (!res.ok) throw new Error('No se pudo guardar la vacante')
      toast(status === 'published' ? 'Puesto publicado' : 'Borrador guardado', 'success')
      setPublished(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  function addFunction() {
    setFunctions(prev => [...prev, ''])
  }

  function updateFunction(idx: number, val: string) {
    setFunctions(prev => prev.map((f, i) => i === idx ? val : f))
  }

  function removeFunction(idx: number) {
    setFunctions(prev => prev.filter((_, i) => i !== idx))
  }

  function canStep1() {
    return committeeId !== '' && positionId !== '' && Number(slots) >= 1
  }

  if (published) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <p className="text-xl font-bold text-navy font-display">
            Puesto guardado
          </p>
          <p className="text-sm text-navy-light/60 font-body">
            Las publicadas quedan disponibles para que los miembros apliquen; los borradores los podés editar luego.
          </p>
          <Link
            href="/servidores/vacantes"
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors mt-2 font-body"
          >
            Ver todas las vacantes
          </Link>
        </div>
      </div>
    )
  }

  if (submitted && step === 2) {
    return (
      <div className="max-w-2xl space-y-4">
        {/* Top bar */}
        <div
          className="rounded-2xl px-5 py-3 flex items-center justify-between gap-3 bg-surface-card shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-3">
            <Link
              href="/servidores/vacantes"
              className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
            >
              <ChevronLeft size={16} />
              Puestos de Servicio
            </Link>
            <span className="text-navy-light/60">|</span>
            <span className="text-sm font-semibold text-navy font-display">
              Preparar publicación
            </span>
          </div>
        </div>

        {/* Banner solicitud */}
        <div
          className="rounded-2xl px-5 py-4 bg-surface-card shadow-[var(--shadow-md)]"
        >
          <p className="text-[11px] tracking-widest uppercase text-navy-light/60 mb-1 font-display">
            Solicitud interna
          </p>
          <p className="text-sm font-semibold text-navy font-display">
            {selectedCommittee?.name} · {position} · {slots} cupo{Number(slots) !== 1 ? 's' : ''}
          </p>
          {justification && (
            <p className="text-[12px] text-navy-light/60 mt-1 font-body">
              {justification}
            </p>
          )}
        </div>

        {/* Formulario de publicación */}
        <div className="rounded-2xl p-5 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display">
              Título de la publicación
            </label>
            <input
              className={inputCls}
              placeholder="Ej: ¡Únete al equipo de bienvenida!"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">
                Descripción pública
              </label>
              <span className="text-[10px] text-navy-light/60 font-mono">
                {description.length}/500
              </span>
            </div>
            <textarea
              className={cn(inputCls, 'resize-none')}
              rows={4}
              maxLength={500}
              placeholder="Describe el puesto de forma atractiva..."
              value={description}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">
              Funciones principales
            </label>
            {functions.map((f, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <span className="text-[11px] text-navy-light/60 shrink-0 w-4 font-mono">
                  {idx + 1}.
                </span>
                <input
                  className={inputCls}
                  placeholder={`Función ${idx + 1}...`}
                  value={f}
                  onChange={e => updateFunction(idx, e.target.value)}
                />
                {functions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFunction(idx)}
                    className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-navy-light/60 hover:text-coral hover:bg-coral/10 transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addFunction}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
            >
              <Plus size={12} />
              Agregar función
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">
                Horario
              </label>
              <input
                className={inputCls}
                placeholder="Ej: Domingos 8am – 12pm"
                value={schedule}
                onChange={e => setSchedule(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">
                Compromiso esperado
              </label>
              <input
                className={inputCls}
                placeholder="Ej: 2 domingos al mes"
                value={commitment}
                onChange={e => setCommitment(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="inline-flex items-center gap-1.5 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
          >
            <ChevronLeft size={14} />
            Volver
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={saving}
            className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 border-[var(--outline-variant)] font-body"
          >
            Guardar como borrador
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('published')}
            disabled={saving || !title.trim() || !description.trim()}
            className={cn(
              'rounded-full px-4 py-2 text-sm text-white transition-colors font-body',
              !saving && title.trim() && description.trim()
                ? 'bg-coral hover:bg-coral-deep'
                : 'bg-navy-light/20 cursor-not-allowed'
            )}
          >
            {saving ? 'Guardando...' : 'Publicar puesto'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-coral text-right font-body">
            {error}
          </p>
        )}
      </div>
    )
  }

  // Step 1 — solicitud interna
  return (
    <div className="max-w-2xl space-y-4">
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 rounded-2xl px-5 py-3 flex items-center justify-between gap-3 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/servidores/vacantes"
            className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
          >
            <ChevronLeft size={16} />
            Puestos de Servicio
          </Link>
          <span className="text-navy-light/60">|</span>
          <span className="text-sm font-semibold text-navy font-display">
            Solicitar puesto
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setSubmitted(true); setStep(2) }}
          disabled={!canStep1()}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] text-white transition-colors font-body',
            canStep1() ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
          )}
        >
          Enviar solicitud
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="rounded-2xl p-5 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">
            Comité
          </label>
          <select
            className={inputCls}
            value={committeeId}
            onChange={e => { setCommitteeId(e.target.value); setPositionId('') }}
          >
            <option value="">Seleccionar comité...</option>
            {committees.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">
            Puesto
          </label>
          <select
            className={inputCls}
            value={positionId}
            onChange={e => setPositionId(e.target.value)}
            disabled={!selectedCommittee}
          >
            <option value="">
              {selectedCommittee ? 'Seleccionar puesto...' : 'Elegí un comité primero'}
            </option>
            {selectedCommittee?.positions?.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">
            Número de servidores necesarios
          </label>
          <input
            type="number"
            min={1}
            className={inputCls}
            placeholder="1"
            value={slots}
            onChange={e => setSlots(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">
            Justificación / notas internas
          </label>
          <textarea
            className={cn(inputCls, 'resize-none')}
            rows={4}
            placeholder="¿Por qué se necesita este puesto? ¿Qué impacto tendrá en el comité?"
            value={justification}
            onChange={e => setJustification(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

export default function NuevaVacantePage() {
  return (
    <Suspense fallback={
      <div className="p-10 text-center text-[var(--fg-muted)]">Cargando...</div>
    }>
      <NuevaVacanteContent />
    </Suspense>
  )
}

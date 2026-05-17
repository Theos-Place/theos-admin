'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MOCK_COMMITTEES } from '@/data/mock-servers'
import { SERVICE_POSITIONS } from '@/data/mock-committees'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

export default function NuevaVacantePage() {
  const params = useSearchParams()
  const preselectedCommittee = params.get('comite') ?? ''

  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [published, setPublished] = useState(false)

  // Step 1 — solicitud interna
  const [committeeId, setCommitteeId] = useState(preselectedCommittee)
  const [position, setPosition]       = useState('')
  const [slots, setSlots]             = useState('1')
  const [justification, setJustification] = useState('')

  // Step 2 — publicación
  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [functions, setFunctions] = useState<string[]>([''])
  const [schedule, setSchedule]   = useState('')
  const [commitment, setCommitment] = useState('')

  const selectedCommittee = MOCK_COMMITTEES.find(c => c.id === committeeId)

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
    return committeeId !== '' && position !== '' && Number(slots) >= 1
  }

  if (published) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Vacante publicada
          </p>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            La vacante está disponible para que los miembros apliquen.
          </p>
          <Link
            href="/servidores/vacantes"
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors mt-2"
            style={{ fontFamily: 'var(--font-body)' }}
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
          className="rounded-2xl px-5 py-3 flex items-center justify-between gap-3"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex items-center gap-3">
            <Link
              href="/servidores/vacantes"
              className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <ChevronLeft size={16} />
              Vacantes
            </Link>
            <span className="text-navy-light/20">|</span>
            <span className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
              Preparar publicación
            </span>
          </div>
        </div>

        {/* Banner solicitud */}
        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
        >
          <p className="text-[11px] tracking-widest uppercase text-navy-light/40 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            Solicitud interna
          </p>
          <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            {selectedCommittee?.name} · {position} · {slots} cupo{Number(slots) !== 1 ? 's' : ''}
          </p>
          {justification && (
            <p className="text-[12px] text-navy-light/60 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
              {justification}
            </p>
          )}
        </div>

        {/* Formulario de publicación */}
        <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Título de la publicación
            </label>
            <input
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              placeholder="Ej: ¡Únete al equipo de bienvenida!"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Descripción pública
              </label>
              <span className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-mono)' }}>
                {description.length}/500
              </span>
            </div>
            <textarea
              className={cn(inputCls, 'resize-none')}
              style={{ fontFamily: 'var(--font-body)' }}
              rows={4}
              maxLength={500}
              placeholder="Describe la vacante de forma atractiva..."
              value={description}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Funciones principales
            </label>
            {functions.map((f, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <span className="text-[11px] text-navy-light/30 shrink-0 w-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  {idx + 1}.
                </span>
                <input
                  className={inputCls}
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder={`Función ${idx + 1}...`}
                  value={f}
                  onChange={e => updateFunction(idx, e.target.value)}
                />
                {functions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFunction(idx)}
                    className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-navy-light/40 hover:text-coral hover:bg-coral/10 transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addFunction}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Plus size={12} />
              Agregar función
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Horario
              </label>
              <input
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Ej: Domingos 8am – 12pm"
                value={schedule}
                onChange={e => setSchedule(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Compromiso esperado
              </label>
              <input
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
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
            className="inline-flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={14} />
            Volver
          </button>
          <div className="flex-1" />
          <button
            type="button"
            className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Guardar como borrador
          </button>
          <button
            type="button"
            onClick={() => setPublished(true)}
            disabled={!title.trim() || !description.trim()}
            className={cn(
              'rounded-full px-4 py-2 text-sm text-white transition-colors',
              title.trim() && description.trim()
                ? 'bg-coral hover:bg-coral-deep'
                : 'bg-navy-light/20 cursor-not-allowed'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Publicar vacante
          </button>
        </div>
      </div>
    )
  }

  // Step 1 — solicitud interna
  return (
    <div className="max-w-2xl space-y-4">
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 rounded-2xl px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/servidores/vacantes"
            className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={16} />
            Vacantes
          </Link>
          <span className="text-navy-light/20">|</span>
          <span className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Solicitar vacante
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setSubmitted(true); setStep(2) }}
          disabled={!canStep1()}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] text-white transition-colors',
            canStep1() ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
          )}
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Enviar solicitud
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Comité
          </label>
          <select
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            value={committeeId}
            onChange={e => setCommitteeId(e.target.value)}
          >
            <option value="">Seleccionar comité...</option>
            {MOCK_COMMITTEES.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Puesto
          </label>
          <select
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            value={position}
            onChange={e => setPosition(e.target.value)}
          >
            <option value="">Seleccionar puesto...</option>
            {SERVICE_POSITIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Número de servidores necesarios
          </label>
          <input
            type="number"
            min={1}
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="1"
            value={slots}
            onChange={e => setSlots(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Justificación / notas internas
          </label>
          <textarea
            className={cn(inputCls, 'resize-none')}
            style={{ fontFamily: 'var(--font-body)' }}
            rows={4}
            placeholder="¿Por qué se necesita esta vacante? ¿Qué impacto tendrá en el comité?"
            value={justification}
            onChange={e => setJustification(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

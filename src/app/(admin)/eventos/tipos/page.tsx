'use client'

import { useState, useEffect, useCallback } from 'react'
import { type EventTypeEntry } from '@/data/event-config'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import {
  Plus, Edit2, Mic, Tent, Users, Star, BookOpen,
  Heart, MapPin, Music, Coffee, Zap, Calendar, Check, Globe,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  mic: Mic, tent: Tent, users: Users, star: Star, 'book-open': BookOpen,
  heart: Heart, 'map-pin': MapPin, calendar: Calendar, music: Music,
  coffee: Coffee, zap: Zap, globe: Globe,
}

const ICON_OPTIONS = Object.keys(ICON_MAP)

const COLOR_SWATCHES = [
  '#161440', '#70BDC2', '#D63E3D', '#3B7579',
  '#29365C', '#F59E0B', '#10B981', '#8B5CF6',
]

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

type FormState = {
  name: string
  description: string
  color: string
  icon: string
  is_active: boolean
}

function TypeModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: EventTypeEntry
  onSave: (data: FormState) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    color: initial?.color ?? '#161440',
    icon: initial?.icon ?? 'mic',
    is_active: initial?.is_active ?? true,
  })
  const [customColor, setCustomColor] = useState(false)

  const valid = form.name.trim().length > 0

  return (
    <Modal onClose={onClose} titleId="tipo-evento-titulo" width={448}>
      <div className="p-6 space-y-5">
        <h2 id="tipo-evento-titulo" className="text-base font-bold text-navy font-display">
          {initial ? 'Editar tipo' : 'Nuevo tipo de evento'}
        </h2>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Nombre *
          </label>
          <input
            className={cn(inputCls, 'font-body')}
            placeholder="Ej. Conferencia"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Descripción
          </label>
          <input
            className={cn(inputCls, 'font-body')}
            placeholder="Breve descripción del tipo"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { setForm(f => ({ ...f, color: c })); setCustomColor(false) }}
                className="h-8 w-8 rounded-full border-2 transition-all duration-150 flex items-center justify-center"
                style={{
                  backgroundColor: c,
                  borderColor: form.color === c && !customColor ? 'white' : 'transparent',
                  boxShadow: form.color === c && !customColor ? '0 0 0 2px ' + c : 'none',
                }}
              >
                {form.color === c && !customColor && <Check size={12} className="text-white" />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomColor(true)}
              className={cn(
                'h-8 px-3 rounded-full text-[13px] border transition-all',
                customColor ? 'border-coral text-coral bg-coral/5' : 'text-navy-light/80 hover:bg-surface-low',
                'font-display'
              )}
              style={{ borderColor: customColor ? undefined : 'var(--outline-variant)' }}
            >
              Custom
            </button>
          </div>
          {customColor && (
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-9 w-16 rounded-xl cursor-pointer border-0"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              />
              <span className="text-sm text-navy-light/80 tabular-nums font-mono">
                {form.color}
              </span>
            </div>
          )}
        </div>

        {/* Icon */}
        <div className="space-y-2">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Ícono
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {ICON_OPTIONS.map(ico => {
              const Icon = ICON_MAP[ico]
              return (
                <button
                  key={ico}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, icon: ico }))}
                  className={cn(
                    'h-10 rounded-xl flex items-center justify-center border transition-all duration-150',
                    form.icon === ico ? 'border-coral bg-coral/5 text-coral' : 'text-navy-light/80 hover:bg-surface-low'
                  )}
                  style={{ borderColor: form.icon === ico ? undefined : 'var(--outline-variant)' }}
                  title={ico}
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3 rounded-xl bg-surface-low px-3 py-2.5">
          <label
            className="toggle cursor-pointer shrink-0"
            title={form.is_active ? 'Clic para desactivar' : 'Clic para activar'}
          >
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            />
            <div className="toggle-track" />
          </label>
          <span className="text-sm font-body text-[var(--fg-muted)]">
            {form.is_active ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            disabled={!valid}
            onClick={() => onSave(form)}
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 font-body"
          >
            {initial ? 'Guardar cambios' : 'Crear tipo'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function TiposEventoPage() {
  const toast = useToast()
  const [types, setTypes] = useState<EventTypeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<EventTypeEntry | null>(null)
  const [saving, setSaving] = useState(false)

  const loadTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/events/types')
      if (res.ok) setTypes(await res.json())
    } catch (err) {
      console.error('No se pudieron cargar los tipos de evento:', err)
      toast('No se pudieron cargar los tipos de evento. Recargá la página.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadTypes() }, [loadTypes])

  async function handleSave(data: FormState) {
    if (saving) return
    setSaving(true)
    try {
      if (editTarget) {
        const res = await fetch(`/api/events/types/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } else {
        const newId = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        const res = await fetch('/api/events/types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newId, ...data }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }
      await loadTypes()
      setShowModal(false)
      setEditTarget(null)
    } catch (err) {
      console.error('No se pudo guardar el tipo de evento:', err)
      toast('No se pudo guardar el tipo de evento. Intentá de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEventType(id: string) {
    const current = types.find(t => t.id === id)
    if (!current) return
    const next = !current.is_active
    setTypes(ts => ts.map(t => t.id === id ? { ...t, is_active: next } : t))
    try {
      const res = await fetch(`/api/events/types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error('No se pudo cambiar el estado del tipo:', err)
      toast('No se pudo cambiar el estado del tipo. Intentá de nuevo.', 'error')
      setTypes(ts => ts.map(t => t.id === id ? { ...t, is_active: !next } : t))
    }
  }

  return (
    <div className="space-y-6">
      {(showModal || editTarget) && (
        <TypeModal
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
          >
            Tipos de evento
          </h1>
          <p className="mt-1 text-sm text-navy-light/80 font-body">
            {types.filter(t => t.is_active).length} activos · {types.length} en total
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true) }}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 font-body"
        >
          <Plus size={14} />
          Nuevo tipo
        </button>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-16">
          <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" aria-hidden="true" />
          <p className="text-sm text-navy-light/80 font-body">Cargando…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && types.length === 0 && (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] px-6 py-12 text-center space-y-3">
          <p className="text-sm text-navy-light/80 font-body">
            Todavía no hay tipos de evento. Creá el primero para clasificar tus eventos.
          </p>
          <button
            onClick={() => { setEditTarget(null); setShowModal(true) }}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 font-body"
          >
            <Plus size={14} />
            Crear tipo
          </button>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(t => (
          <div
            key={t.id}
            className={cn('rounded-2xl transition-all duration-150 bg-surface-card shadow-[var(--shadow-md)] py-4 px-[18px]', !t.is_active && 'opacity-55')}
          >
            {/* Top row: icon + name — toggle */}
            <div className="flex items-center justify-between mb-[10px]">
              <div className="flex items-center gap-[10px]">
                <div
                  className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0"
                  style={{
                    background: t.color + '18',
                    border: `1.5px solid ${t.color}33`,
                    color: t.color,
                  }}
                >
                  {(() => { const Icon = ICON_MAP[t.icon] ?? Calendar; return <Icon size={18} /> })()}
                </div>
                <span className="font-bold text-[14px] text-navy-light font-display">
                  {t.name}
                </span>
              </div>
              <label
                className="toggle cursor-pointer shrink-0"
                title={t.is_active ? 'Clic para desactivar este tipo de evento' : 'Clic para activar este tipo de evento'}
              >
                <input
                  type="checkbox"
                  checked={t.is_active}
                  onChange={() => toggleEventType(t.id)}
                />
                <div className="toggle-track" />
              </label>
            </div>

            {/* Descripción */}
            {t.description && (
              <p className="text-[13px] text-[var(--fg-muted)] mb-[14px] ml-12 font-body">
                {t.description}
              </p>
            )}

            {/* Footer: solo Editar */}
            <div className="flex justify-end">
              <button
                onClick={() => { setEditTarget(t); setShowModal(true) }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                <Edit2 size={11} />
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

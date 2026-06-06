'use client'

import { useState, useEffect } from 'react'
import { type EventTypeEntry } from '@/data/mock-events'
import { cn } from '@/lib/utils'
import {
  Plus, Edit2, X, Mic, Tent, Users, Star, BookOpen,
  Heart, MapPin, Music, Coffee, Zap, Calendar, Check, Globe,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  mic: Mic, tent: Tent, users: Users, star: Star, 'book-open': BookOpen,
  heart: Heart, 'map-pin': MapPin, calendar: Calendar, music: Music,
  coffee: Coffee, zap: Zap, globe: Globe,
}

const ICON_OPTIONS = Object.keys(ICON_MAP)

const COLOR_SWATCHES = [
  '#161440', '#70BDC2', '#EF5554', '#519DA2',
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

function IconPreview({ icon, size = 16, className, color }: { icon: string; size?: number; className?: string; color?: string }) {
  const Icon = ICON_MAP[icon] ?? Mic
  return (
    <span style={color ? { color } : undefined} className={className}>
      <Icon size={size} />
    </span>
  )
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl p-6 max-w-md w-full mx-4 space-y-5"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            {initial ? 'Editar tipo' : 'Nuevo tipo de evento'}
          </h2>
          <button onClick={onClose} className="text-navy-light/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Nombre *
          </label>
          <input
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="Ej. Conferencia"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Descripción
          </label>
          <input
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="Breve descripción del tipo"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <label className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
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
                'h-8 px-3 rounded-full text-[11px] border transition-all',
                customColor ? 'border-coral text-coral bg-coral/5' : 'text-navy-light/60 hover:bg-surface-low'
              )}
              style={{ borderColor: customColor ? undefined : 'var(--outline-variant)', fontFamily: 'var(--font-display)' }}
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
              <span className="text-sm text-navy-light/60 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {form.color}
              </span>
            </div>
          )}
        </div>

        {/* Icon */}
        <div className="space-y-2">
          <label className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
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
                    form.icon === ico ? 'border-coral bg-coral/5 text-coral' : 'text-navy-light/50 hover:bg-surface-low'
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
            className="toggle"
            title={form.is_active ? 'Clic para desactivar' : 'Clic para activar'}
            style={{ cursor: 'pointer', flexShrink: 0 }}
          >
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            />
            <div className="toggle-track" />
          </label>
          <span className="text-sm" style={{ fontFamily: 'var(--font-body)', color: 'var(--fg-muted)' }}>
            {form.is_active ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            disabled={!valid}
            onClick={() => onSave(form)}
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {initial ? 'Guardar cambios' : 'Crear tipo'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TiposEventoPage() {
  const [types, setTypes] = useState<EventTypeEntry[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<EventTypeEntry | null>(null)
  const [saving, setSaving] = useState(false)

  async function loadTypes() {
    try {
      const res = await fetch('/api/events/types')
      if (res.ok) setTypes(await res.json())
    } catch (err) {
      console.error('No se pudieron cargar los tipos de evento:', err)
    }
  }

  useEffect(() => { loadTypes() }, [])

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
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Tipos de evento
          </h1>
          <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            {types.filter(t => t.is_active).length} activos · {types.length} en total
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true) }}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Plus size={14} />
          Nuevo tipo
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(t => (
          <div
            key={t.id}
            className={cn('rounded-2xl transition-all duration-150', !t.is_active && 'opacity-55')}
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)', padding: '16px 18px' }}
          >
            {/* Top row: icon + name — toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: t.color + '18',
                  border: `1.5px solid ${t.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: t.color, flexShrink: 0,
                }}>
                  {(() => { const Icon = ICON_MAP[t.icon] ?? Calendar; return <Icon size={18} /> })()}
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand-navy)', fontFamily: 'var(--font-display)' }}>
                  {t.name}
                </span>
              </div>
              <label
                className="toggle"
                title={t.is_active ? 'Clic para desactivar este tipo de evento' : 'Clic para activar este tipo de evento'}
                style={{ cursor: 'pointer', flexShrink: 0 }}
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
              <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 14, marginLeft: 48, fontFamily: 'var(--font-body)' }}>
                {t.description}
              </p>
            )}

            {/* Footer: solo Editar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditTarget(t); setShowModal(true) }}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
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

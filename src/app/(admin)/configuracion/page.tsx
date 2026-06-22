'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Check, Loader2, Plus, Trash2, Search, BellRing } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOAST_SHORT_MS } from '@/lib/constants'
import type { NotificationRecipient } from '@/types/study'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 rounded-full transition-colors shrink-0', checked ? 'bg-coral' : 'bg-navy/20')}
    >
      <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  )
}

export default function ConfiguracionPage() {
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_SHORT_MS)
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Configuración de mi cuenta
        </h1>
        <p className="mt-1 text-sm text-navy-light/60 font-body">
          Gestioná tus preferencias de notificación
        </p>
      </div>

      <NotificacionesTab onSave={() => showToast('Preferencias guardadas')} />

      <StudyNotificationRecipients onChange={showToast} />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white font-body bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)]"
        >
          <Check size={15} className="text-teal shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}

/* ── Notificaciones ── */
function NotificacionesTab({ onSave }: { onSave: () => void }) {
  const [prefs, setPrefs] = useState({
    recordatorios_eventos:  true,
    grupo_estudio:          true,
    mensajes_sistema:       true,
    comunicaciones_masivas: false,
  })
  // Por ahora solo correo: WhatsApp y Ambos quedan deshabilitados (próximamente).
  const [canal, setCanal] = useState<'whatsapp' | 'email' | 'both'>('email')
  const [saving, setSaving] = useState(false)

  function toggle(key: keyof typeof prefs) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    onSave()
  }

  const NOTIF_ITEMS: { key: keyof typeof prefs; label: string; desc: string }[] = [
    { key: 'recordatorios_eventos',  label: 'Recordatorios de eventos',           desc: 'Avisos de eventos en los que estás inscrito' },
    { key: 'grupo_estudio',          label: 'Notificaciones de grupo de estudio', desc: 'Cambios o novedades en tu grupo actual' },
    { key: 'mensajes_sistema',       label: 'Mensajes del sistema',               desc: 'Alertas de seguridad y actualizaciones importantes' },
    { key: 'comunicaciones_masivas', label: 'Comunicaciones masivas de Theos',    desc: 'Anuncios generales a toda la congregación' },
  ]

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* Toggles */}
      <div className="rounded-2xl p-6 space-y-5 bg-surface-card shadow-card">
        <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
          Preferencias de notificación
        </p>
        {NOTIF_ITEMS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-navy font-body">{label}</p>
              <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">{desc}</p>
            </div>
            <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
          </div>
        ))}
      </div>

      {/* Canal preferido */}
      <div className="rounded-2xl p-6 space-y-4 bg-surface-card shadow-card">
        <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
          Canal preferido
        </p>
        <div className="flex gap-2">
          {([
            { key: 'email',    label: 'Correo',   disabled: false },
            { key: 'whatsapp', label: 'WhatsApp', disabled: true  },
            { key: 'both',     label: 'Ambos',    disabled: true  },
          ] as const).map(opt => (
            <button
              key={opt.key}
              type="button"
              disabled={opt.disabled}
              onClick={() => { if (!opt.disabled) setCanal(opt.key) }}
              aria-label={opt.disabled ? `${opt.label} (próximamente)` : opt.label}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 rounded-xl border py-3 text-[13px] font-medium transition-all font-body',
                opt.disabled
                  ? 'opacity-50 cursor-not-allowed text-navy-light/60'
                  : canal === opt.key ? 'bg-navy border-navy text-white' : 'text-navy-light/60 hover:text-navy'
              )}
              style={{ borderColor: !opt.disabled && canal === opt.key ? undefined : 'var(--outline-variant)' }}
            >
              {opt.label}
              {opt.disabled && <span className="text-[10px] font-normal text-navy-light/60">Próximamente</span>}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-coral px-6 py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-all disabled:opacity-60 font-body"
        style={{ boxShadow: saving ? 'none' : '0 8px 24px rgba(239,85,84,0.25)' }}
      >
        {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : 'Guardar preferencias'}
      </button>
    </form>
  )
}

/* ── Destinatarios de notificaciones de solicitudes de estudios ──
   Visible solo si el API lo permite (admin / coordinador de estudios):
   con 403 la sección no se renderiza. */
type EligibleCoordinator = { member_id: string; member_name: string; roles: string[] }

const ROLE_SHORT: Record<string, string> = {
  admin: 'Admin',
  coordinador_estudios: 'Coord. Estudios',
  coordinador_dirigentes: 'Coord. Dirigentes',
}

function coordinatorInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '—'
}

function StudyNotificationRecipients({ onChange }: { onChange: (msg: string) => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([])
  const [eligible, setEligible] = useState<EligibleCoordinator[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let alive = true
    fetch('/api/studies/requests/recipients')
      .then(async res => {
        if (!alive) return
        if (!res.ok) { setAllowed(false); return }
        const data = await res.json()
        if (!alive) return
        setRecipients(data)
        setAllowed(true)
      })
      .catch(() => { if (alive) setAllowed(false) })
    return () => { alive = false }
  }, [reloadKey])

  useEffect(() => {
    if (!pickerOpen || eligible.length) return
    fetch('/api/studies/requests/recipients?eligible=1')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setEligible(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [pickerOpen, eligible.length])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    if (pickerOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [pickerOpen])

  const options = useMemo(() => {
    const used = new Set(recipients.map(r => r.member_id))
    const term = q.trim().toLowerCase()
    return eligible
      .filter(e => !used.has(e.member_id))
      .filter(e => !term || e.member_name.toLowerCase().includes(term))
  }, [eligible, recipients, q])

  async function add(memberId: string) {
    setBusy(true)
    setPickerOpen(false)
    setQ('')
    try {
      const res = await fetch('/api/studies/requests/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })
      if (!res.ok) throw new Error()
      reload()
      onChange('Coordinador agregado')
    } catch {
      onChange('No se pudo agregar el coordinador')
    } finally {
      setBusy(false)
    }
  }

  async function remove(memberId: string, name: string) {
    if (!window.confirm(`¿Quitar a ${name} de los destinatarios?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/studies/requests/recipients?member_id=${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      reload()
      onChange('Coordinador eliminado')
    } catch {
      onChange('No se pudo eliminar el coordinador')
    } finally {
      setBusy(false)
    }
  }

  if (allowed !== true) return null

  return (
    <div className="rounded-2xl p-6 space-y-4 bg-surface-card shadow-card">
      <div className="flex items-center gap-2">
        <BellRing size={15} className="text-coral" />
        <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
          Notificaciones de estudios
        </p>
      </div>
      <p className="text-[13px] text-navy-light/60 font-body">
        Estos coordinadores reciben una notificación interna cada vez que llega
        una solicitud de estudios (reubicación, unirse a grupo o grupo nuevo).
      </p>

      {recipients.length === 0 ? (
        <div className="rounded-xl bg-coral/7 border border-coral/20 px-4 py-3">
          <p className="text-[13px] text-coral font-body">
            No hay coordinadores configurados. Las solicitudes no enviarán
            notificaciones hasta que agregues al menos uno.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {recipients.map(r => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-low px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[11px] font-display font-extrabold">
                {coordinatorInitials(r.member_name)}
              </span>
              <span className="flex-1 truncate text-sm text-navy font-body">{r.member_name}</span>
              <button
                onClick={() => remove(r.member_id, r.member_name)}
                disabled={busy}
                aria-label={`Quitar a ${r.member_name}`}
                className="rounded-lg p-1.5 text-navy-light/60 hover:text-coral hover:bg-coral/10 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Picker de coordinadores elegibles */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen(v => !v)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-[13px] text-white font-body hover:bg-navy-ink transition-colors disabled:opacity-60"
        >
          <Plus size={14} />
          Agregar coordinador
        </button>

        {pickerOpen && (
          <div className="absolute z-30 mt-2 w-full max-w-sm rounded-2xl bg-surface-card shadow-card-lg border border-outline overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-outline">
              <Search size={14} className="text-navy-light/60 shrink-0" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar coordinador…"
                aria-label="Buscar coordinador"
                className="min-w-0 flex-1 bg-transparent text-sm text-navy outline-none font-body placeholder:text-navy-light/50"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {options.length === 0 ? (
                <p className="px-3 py-3 text-xs text-navy-light/60 font-body">
                  {eligible.length === 0 ? 'Cargando…' : 'Sin coordinadores disponibles'}
                </p>
              ) : options.map(o => (
                <button
                  key={o.member_id}
                  onClick={() => add(o.member_id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-low transition-colors"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
                    {coordinatorInitials(o.member_name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">{o.member_name}</span>
                  <span className="shrink-0 rounded-full bg-teal/15 px-2 py-0.5 text-[10px] text-teal-deep font-body">
                    {o.roles.map(r => ROLE_SHORT[r] ?? r).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

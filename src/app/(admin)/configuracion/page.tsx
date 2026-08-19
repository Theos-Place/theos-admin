'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOAST_SHORT_MS } from '@/lib/constants'

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange(!checked) }}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors shrink-0',
        checked ? 'bg-coral' : 'bg-navy/20',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
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
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Configuración de mi cuenta
        </h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          Gestioná tus preferencias de notificación
        </p>
      </div>

      <NotificacionesTab onToast={showToast} />

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
type NotifPrefs = {
  recordatorios_eventos: boolean
  grupo_estudio: boolean
  mensajes_sistema: boolean
  canal_preferido: 'email' | 'whatsapp' | 'ambos'
  email_subscribed: boolean
  email_bounced: boolean
  email_complained: boolean
}

function NotificacionesTab({ onToast }: { onToast: (msg: string) => void }) {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/notifications/preferences')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: NotifPrefs) => { if (alive) { setPrefs(d); setError(false) } })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  function toggle(key: 'recordatorios_eventos' | 'grupo_estudio' | 'mensajes_sistema' | 'email_subscribed') {
    setPrefs(prev => (prev ? { ...prev, [key]: !prev[key] } : prev))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!prefs) return
    setSaving(true)
    const emailBlocked = prefs.email_bounced || prefs.email_complained
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordatorios_eventos: prefs.recordatorios_eventos,
          grupo_estudio: prefs.grupo_estudio,
          mensajes_sistema: prefs.mensajes_sistema,
          canal_preferido: prefs.canal_preferido,
          // El correo bloqueado por rebote/queja no se toca desde acá.
          ...(emailBlocked ? {} : { email_subscribed: prefs.email_subscribed }),
        }),
      })
      if (!res.ok) throw new Error()
      onToast('Preferencias guardadas')
    } catch {
      onToast('No se pudieron guardar las preferencias')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-44 rounded-2xl bg-surface-card animate-pulse" />
        <div className="h-28 rounded-2xl bg-surface-card animate-pulse" />
      </div>
    )
  }
  if (error || !prefs) {
    return (
      <div className="rounded-2xl p-6 bg-surface-card shadow-card">
        <p className="text-sm text-coral font-body">No se pudieron cargar tus preferencias. Recargá la página.</p>
      </div>
    )
  }

  const INTERNAL_ITEMS: { key: 'recordatorios_eventos' | 'grupo_estudio' | 'mensajes_sistema'; label: string; desc: string }[] = [
    { key: 'recordatorios_eventos', label: 'Recordatorios de eventos',           desc: 'Avisos de eventos en los que estás inscrito' },
    { key: 'grupo_estudio',         label: 'Notificaciones de grupo de estudio', desc: 'Cambios o novedades en tu grupo actual' },
    { key: 'mensajes_sistema',      label: 'Mensajes del sistema',               desc: 'Avisos generales del sistema (las alertas de seguridad siempre se envían)' },
  ]

  const emailBlocked = prefs.email_bounced || prefs.email_complained

  return (
    <form onSubmit={handleSave} className="space-y-5">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Toggles */}
      <div className="rounded-2xl p-6 space-y-5 bg-surface-card shadow-card">
        <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
          Preferencias de notificación
        </p>
        {INTERNAL_ITEMS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-navy font-body">{label}</p>
              <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">{desc}</p>
            </div>
            <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
          </div>
        ))}

        {/* Suscripción por email — fuente: members.newsletter_opt_out */}
        <div className="flex items-start justify-between gap-4 pt-1 border-t border-[var(--outline-variant)]">
          <div>
            <p className="text-sm font-medium text-navy font-body">Suscripción por email</p>
            <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">Newsletters, invitaciones a eventos y campañas</p>
            {emailBlocked && (
              <p className="text-[13px] text-coral mt-1 font-body">
                Tu correo presentó problemas de entrega. Contacta a Theos Place para reactivarlo.
              </p>
            )}
          </div>
          <Toggle
            checked={!emailBlocked && prefs.email_subscribed}
            disabled={emailBlocked}
            onChange={() => toggle('email_subscribed')}
          />
        </div>
      </div>

      {/* Canal preferido */}
      <div className="rounded-2xl p-6 space-y-4 bg-surface-card shadow-card">
        <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
          Canal preferido
        </p>
        <div className="flex gap-2">
          {([
            { key: 'email',    label: 'Correo',   disabled: false },
            { key: 'whatsapp', label: 'WhatsApp', disabled: true  },
            { key: 'ambos',    label: 'Ambos',    disabled: true  },
          ] as const).map(opt => (
            <button
              key={opt.key}
              type="button"
              disabled={opt.disabled}
              onClick={() => { if (!opt.disabled) setPrefs(prev => (prev ? { ...prev, canal_preferido: opt.key } : prev)) }}
              aria-label={opt.disabled ? `${opt.label} (próximamente)` : opt.label}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 rounded-xl border py-3 text-[13px] font-medium transition-all font-body',
                opt.disabled
                  ? 'opacity-50 cursor-not-allowed text-navy-light/80'
                  : prefs.canal_preferido === opt.key ? 'bg-navy border-navy text-white' : 'text-navy-light/80 hover:text-navy'
              )}
              style={{ borderColor: !opt.disabled && prefs.canal_preferido === opt.key ? undefined : 'var(--outline-variant)' }}
            >
              {opt.label}
              {opt.disabled && <span className="text-[11px] font-normal text-navy-light/80">Próximamente</span>}
            </button>
          ))}
        </div>
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

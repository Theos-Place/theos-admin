'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOAST_SHORT_MS } from '@/lib/constants'

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
        <h1 className="text-2xl text-navy font-display" style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Configuración de mi cuenta
        </h1>
        <p className="mt-1 text-sm text-navy-light/50 font-body">
          Gestioná tus preferencias de notificación
        </p>
      </div>

      <NotificacionesTab onSave={() => showToast('Preferencias guardadas')} />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white font-body"
          style={{ background: '#161440', boxShadow: '0 12px 32px rgba(22,20,64,0.20)' }}
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
  const [canal, setCanal] = useState<'whatsapp' | 'email' | 'both'>('whatsapp')
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
      <div className="rounded-2xl p-6 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display">
          Preferencias de notificación
        </p>
        {NOTIF_ITEMS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-navy font-body">{label}</p>
              <p className="text-[12px] text-navy-light/50 mt-0.5 font-body">{desc}</p>
            </div>
            <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
          </div>
        ))}
      </div>

      {/* Canal preferido */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display">
          Canal preferido
        </p>
        <div className="flex gap-2">
          {([
            { key: 'whatsapp', label: 'WhatsApp' },
            { key: 'email',    label: 'Correo'   },
            { key: 'both',     label: 'Ambos'    },
          ] as const).map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setCanal(opt.key)}
              className={cn(
                'flex-1 rounded-xl border py-3 text-[13px] font-medium transition-all font-body',
                canal === opt.key ? 'bg-navy border-navy text-white' : 'text-navy-light/60 hover:text-navy'
              )}
              style={{ borderColor: canal === opt.key ? undefined : 'var(--outline-variant)' }}
            >
              {opt.label}
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

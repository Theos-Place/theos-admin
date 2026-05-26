'use client'

import { useState, useEffect } from 'react'
import {
  Shield, Bell, Eye, EyeOff, Check, Loader2,
  AlertCircle, Smartphone, Monitor, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOAST_SHORT_MS } from '@/lib/constants'

type Tab = 'seguridad' | 'notificaciones'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'seguridad',       label: 'Seguridad',        icon: Shield },
  { id: 'notificaciones',  label: 'Notificaciones',   icon: Bell   },
]

const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all placeholder:text-navy-light/25',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
  'border-[rgba(22,20,64,0.15)]',
].join(' ')

const LABEL = 'block text-[12px] font-medium text-navy-light/60 mb-1.5'

const REQS = [
  { label: 'Mínimo 8 caracteres',    test: (v: string) => v.length >= 8 },
  { label: 'Al menos una mayúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Al menos un número',     test: (v: string) => /[0-9]/.test(v) },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 rounded-full transition-colors shrink-0', checked ? 'bg-coral' : 'bg-navy/20')}
    >
      <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  )
}

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('seguridad')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_SHORT_MS)
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl text-navy" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Configuración de mi cuenta
        </h1>
        <p className="mt-1 text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Gestioná tu perfil, seguridad y preferencias
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-low)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-medium transition-all',
              tab === id ? 'bg-white text-navy shadow-sm' : 'text-navy-light/50 hover:text-navy'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Icon size={15} className="shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'seguridad' && (
        <SeguridadTab onSave={showToast} />
      )}
      {tab === 'notificaciones' && (
        <NotificacionesTab onSave={() => showToast('Preferencias guardadas')} />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white"
          style={{ background: '#161440', boxShadow: '0 12px 32px rgba(22,20,64,0.20)', fontFamily: 'var(--font-body)' }}
        >
          <Check size={15} className="text-teal shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}

/* ── Tab Seguridad ── */
function SeguridadTab({ onSave }: { onSave: (msg: string) => void }) {
  const [current, setCurrent]       = useState('')
  const [newPass, setNewPass]       = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmErr, setConfirmErr] = useState('')
  const [saving, setSaving]         = useState(false)
  const [smartLinkActive, setSmartLinkActive] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  const reqs = REQS.map(r => ({ ...r, met: r.test(newPass) }))
  const allMet = reqs.every(r => r.met)

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirm) { setConfirmErr('Las contraseñas no coinciden'); return }
    if (!allMet || !current) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 1000))
    setSaving(false)
    setCurrent(''); setNewPass(''); setConfirm('')
    onSave('Contraseña actualizada correctamente')
  }

  async function handleRegenerate() {
    setRegenerating(true)
    await new Promise(r => setTimeout(r, 1100))
    setRegenerating(false)
    onSave('Nuevo Smart Link generado · Enviado a tu WhatsApp')
  }

  const SESSIONS = [
    { device: 'Chrome', os: 'Mac', last: 'Ahora', isCurrent: true },
    { device: 'Safari', os: 'iPhone', last: 'Hace 2 días', isCurrent: false },
  ]

  return (
    <div className="space-y-5">

      {/* Cambiar contraseña */}
      <div className="rounded-2xl p-6 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Cambiar contraseña
        </p>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          {/* Contraseña actual */}
          <div>
            <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Contraseña actual</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="••••••••"
                className={`${INPUT} pr-11`}
                style={{ fontFamily: 'var(--font-body)' }}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/30 hover:text-navy-light/60" tabIndex={-1}>
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Nueva contraseña */}
          <div>
            <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="••••••••"
                className={`${INPUT} pr-11`}
                style={{ fontFamily: 'var(--font-body)' }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/30 hover:text-navy-light/60" tabIndex={-1}>
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Requisitos */}
            <div className="mt-2 space-y-1.5 px-1">
              {reqs.map(req => (
                <div
                  key={req.label}
                  className="flex items-center gap-2 text-[12px] transition-colors"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: newPass.length === 0 ? 'rgba(41,54,92,0.35)' : req.met ? '#519DA2' : 'rgba(239,85,84,0.7)',
                  }}
                >
                  {req.met && newPass.length > 0
                    ? <Check size={12} className="shrink-0" />
                    : <span className="h-3 w-3 rounded-full border shrink-0" style={{ borderColor: 'currentColor', display: 'inline-block' }} />
                  }
                  {req.label}
                </div>
              ))}
            </div>
          </div>

          {/* Confirmar */}
          <div>
            <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Confirmar contraseña</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); if (confirmErr) setConfirmErr('') }}
                onBlur={() => { if (confirm && newPass !== confirm) setConfirmErr('Las contraseñas no coinciden') }}
                placeholder="••••••••"
                className={cn(`${INPUT} pr-11`, confirmErr ? 'border-coral/50 focus:ring-coral/10' : '')}
                style={{ fontFamily: 'var(--font-body)' }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/30 hover:text-navy-light/60" tabIndex={-1}>
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmErr && (
              <p className="flex items-center gap-1.5 mt-1.5 text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                <AlertCircle size={12} className="shrink-0" /> {confirmErr}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !allMet || !current || !confirm}
            className="flex items-center gap-2 rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Actualizando...</> : 'Actualizar contraseña'}
          </button>
        </form>
      </div>

      {/* Smart Link */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Métodos de acceso
        </p>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(112,189,194,0.12)' }}>
              <Zap size={16} style={{ color: '#519DA2' }} />
            </div>
            <div>
              <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>Smart Link activo</p>
              <p className="text-[12px] text-navy-light/50 mt-0.5 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                Permite acceder sin contraseña desde el link<br />enviado por WhatsApp/correo
              </p>
            </div>
          </div>
          <Toggle checked={smartLinkActive} onChange={setSmartLinkActive} />
        </div>
        {smartLinkActive && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] text-navy-light hover:bg-surface-low transition-all disabled:opacity-50"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            {regenerating ? <><Loader2 size={13} className="animate-spin" /> Generando...</> : 'Regenerar Smart Link'}
          </button>
        )}
      </div>

      {/* Sesiones */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Sesiones activas
        </p>
        <div className="space-y-2">
          {SESSIONS.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--surface-low)' }}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(22,20,64,0.06)' }}>
                  {s.os === 'iPhone' ? <Smartphone size={15} className="text-navy-light/50" /> : <Monitor size={15} className="text-navy-light/50" />}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                    {s.device} — {s.os}
                  </p>
                  <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>{s.last}</p>
                </div>
              </div>
              {s.isCurrent ? (
                <span className="text-[11px] rounded-full px-2.5 py-1 font-medium" style={{ background: 'rgba(61,185,122,0.10)', color: '#3DB97A', fontFamily: 'var(--font-body)' }}>
                  Esta sesión
                </span>
              ) : (
                <button
                  className="text-[12px] text-coral hover:text-coral-deep transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                  onClick={() => onSave('Sesión cerrada')}
                >
                  Cerrar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Tab Notificaciones ── */
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
    { key: 'recordatorios_eventos',  label: 'Recordatorios de eventos',         desc: 'Avisos de eventos en los que estás inscrito' },
    { key: 'grupo_estudio',          label: 'Notificaciones de grupo de estudio', desc: 'Cambios o novedades en tu grupo actual' },
    { key: 'mensajes_sistema',       label: 'Mensajes del sistema',              desc: 'Alertas de seguridad y actualizaciones importantes' },
    { key: 'comunicaciones_masivas', label: 'Comunicaciones masivas de Theos',   desc: 'Anuncios generales a toda la congregación' },
  ]

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* Toggles */}
      <div className="rounded-2xl p-6 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Preferencias de notificación
        </p>
        {NOTIF_ITEMS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{label}</p>
              <p className="text-[12px] text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>{desc}</p>
            </div>
            <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
          </div>
        ))}
      </div>

      {/* Canal preferido */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
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
                'flex-1 rounded-xl border py-3 text-[13px] font-medium transition-all',
                canal === opt.key ? 'bg-navy border-navy text-white' : 'text-navy-light/60 hover:text-navy'
              )}
              style={{ borderColor: canal === opt.key ? undefined : 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-coral px-6 py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-all disabled:opacity-60"
        style={{ fontFamily: 'var(--font-body)', boxShadow: saving ? 'none' : '0 8px 24px rgba(239,85,84,0.25)' }}
      >
        {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : 'Guardar preferencias'}
      </button>
    </form>
  )
}

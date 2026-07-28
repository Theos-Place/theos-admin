'use client'

import { useState, useEffect } from 'react'
import { type ChannelConfig } from '@/types/communication'
import { useCommunications } from '@/hooks/useCommunications'
import { useAuth } from '@/hooks/useAuth'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Info,
  Edit,
  Send,
} from 'lucide-react'

type SmtpTab = 'smtp' | 'whatsapp'

const INITIAL_SMTP_FORM = {
  name: '', host: '', port: '587', user: '', password: '', from_name: '', from_email: '', ssl: true,
}
const INITIAL_WA_FORM = {
  name: '', account_id: '', token: '', phone: '',
}

export default function ConfiguracionPage() {
  // COM-1: la configuración de remitentes/SMTP es SOLO admin (espejo del API;
  // por URL directa tampoco se entra). El resto de comunicaciones queda igual.
  const { user, loaded } = useAuth()
  const isAdmin = (user?.roles ?? []).includes('admin')
  const { configs: allConfigs, refetch } = useCommunications('configs')
  const [tab, setTab] = useState<SmtpTab>('smtp')
  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  useEffect(() => { setConfigs(allConfigs) }, [allConfigs])
  const [deleteTarget, setDeleteTarget] = useState<ChannelConfig | null>(null)
  const [showSmtpForm, setShowSmtpForm] = useState(false)
  const [showWaForm, setShowWaForm] = useState(false)
  const [smtpForm, setSmtpForm] = useState(INITIAL_SMTP_FORM)
  const [waForm, setWaForm] = useState(INITIAL_WA_FORM)
  const [showPwd, setShowPwd] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<Record<string, 'ok' | 'error'>>({})
  const [editingConfig, setEditingConfig] = useState<ChannelConfig | null>(null)
  const [editSmtpForm, setEditSmtpForm] = useState(INITIAL_SMTP_FORM)
  const [editWaForm, setEditWaForm] = useState(INITIAL_WA_FORM)
  const [showEditPwd, setShowEditPwd] = useState(false)
  const [showEditToken, setShowEditToken] = useState(false)

  const smtpConfigs = configs.filter(c => c.type === 'smtp')
  const waConfigs = configs.filter(c => c.type === 'whatsapp')

  function openEditSmtp(config: ChannelConfig) {
    setEditSmtpForm({
      name: config.name,
      host: config.smtp_host ?? '',
      port: String(config.smtp_port ?? 587),
      user: config.smtp_user ?? '',
      password: '',
      from_name: config.smtp_from_name ?? '',
      from_email: config.smtp_from_email ?? '',
      ssl: true,
    })
    setEditingConfig(config)
  }

  function openEditWa(config: ChannelConfig) {
    setEditWaForm({
      name: config.name,
      account_id: config.wa_account_id ?? '',
      token: '',
      phone: config.wa_phone_number ?? '',
    })
    setEditingConfig(config)
  }

  async function handleSaveEditSmtp() {
    if (!editingConfig) return
    const id = editingConfig.id
    setEditingConfig(null)
    try {
      const res = await fetch(`/api/communications/configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editSmtpForm.name || undefined,
          smtp_host: editSmtpForm.host || null,
          smtp_port: parseInt(editSmtpForm.port) || null,
          smtp_user: editSmtpForm.user || null,
          smtp_from_name: editSmtpForm.from_name || null,
          smtp_from_email: editSmtpForm.from_email || null,
        }),
      })
      if (!res.ok) throw new Error()
      await refetch()
    } catch { /* sin cambios si falla */ }
  }

  async function handleSaveEditWa() {
    if (!editingConfig) return
    const id = editingConfig.id
    setEditingConfig(null)
    try {
      const res = await fetch(`/api/communications/configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editWaForm.name || undefined,
          wa_account_id: editWaForm.account_id || null,
          wa_phone_number: editWaForm.phone || null,
        }),
      })
      if (!res.ok) throw new Error()
      await refetch()
    } catch { /* sin cambios si falla */ }
  }

  async function handleVerify(id: string) {
    setVerifying(id)
    try {
      const res = await fetch(`/api/communications/configs/${id}/verify`, { method: 'POST' })
      setVerifyResult(prev => ({ ...prev, [id]: res.ok ? 'ok' : 'error' }))
      if (res.ok) await refetch()
    } catch {
      setVerifyResult(prev => ({ ...prev, [id]: 'error' }))
    } finally {
      setVerifying(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    try {
      const res = await fetch(`/api/communications/configs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await refetch()
    } catch { /* sin cambios si falla */ }
  }

  async function handleAddSmtp() {
    try {
      const res = await fetch('/api/communications/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'smtp',
          name: smtpForm.name || 'Nueva cuenta SMTP',
          smtp_host: smtpForm.host || null,
          smtp_port: parseInt(smtpForm.port) || null,
          smtp_user: smtpForm.user || null,
          smtp_from_name: smtpForm.from_name || null,
          smtp_from_email: smtpForm.from_email || null,
          is_active: true,
        }),
      })
      if (!res.ok) throw new Error()
      setSmtpForm(INITIAL_SMTP_FORM)
      setShowSmtpForm(false)
      await refetch()
    } catch { /* sin cambios si falla */ }
  }

  async function handleAddWa() {
    try {
      const res = await fetch('/api/communications/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'whatsapp',
          name: waForm.name || 'Nueva cuenta WhatsApp',
          wa_account_id: waForm.account_id || null,
          wa_phone_number: waForm.phone || null,
          is_active: true,
        }),
      })
      if (!res.ok) throw new Error()
      setWaForm(INITIAL_WA_FORM)
      setShowWaForm(false)
      await refetch()
    } catch { /* sin cambios si falla */ }
  }

  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
  const labelCls = 'text-[11px] text-navy-light/70 mb-1 block font-body'

  function SmtpCard({ config }: { config: ChannelConfig }) {
    const result = verifyResult[config.id]
    return (
      <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-navy font-body">{config.name}</p>
            <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">
              {config.smtp_host}:{config.smtp_port} · {config.smtp_user}
            </p>
            <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">
              De: {config.smtp_from_name} &lt;{config.smtp_from_email}&gt;
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {config.is_verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft/30 px-2.5 py-0.5 text-[10px] font-semibold text-teal-deep font-display">
                <CheckCircle2 size={10} /> Verificado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 font-display">
                <AlertCircle size={10} /> Sin verificar
              </span>
            )}
          </div>
        </div>

        {result && (
          <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-body', result === 'ok' ? 'bg-teal-soft/20 text-teal-deep' : 'bg-coral/10 text-coral')}>
            {result === 'ok' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {result === 'ok' ? '✓ Conexión exitosa' : '✗ No se pudo conectar. Verificá los datos.'}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-[var(--outline-variant)]">
          <button
            type="button"
            onClick={() => handleVerify(config.id)}
            disabled={verifying === config.id}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 border-[var(--outline-variant)] font-body"
          >
            {verifying === config.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Verificar
          </button>
          <button type="button" onClick={() => openEditSmtp(config)} aria-label={`Editar cuenta ${config.name}`} className="rounded-full border p-1.5 text-navy-light/60 hover:text-navy hover:bg-surface-low transition-colors border-[var(--outline-variant)]">
            <Edit size={13} />
          </button>
          <button type="button" onClick={() => setDeleteTarget(config)} aria-label={`Eliminar cuenta ${config.name}`} className="rounded-full border p-1.5 text-navy-light/60 hover:text-coral hover:bg-coral/5 hover:border-coral/20 transition-colors border-[var(--outline-variant)]">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  function WaCard({ config }: { config: ChannelConfig }) {
    const result = verifyResult[config.id]
    return (
      <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-navy font-body">{config.name}</p>
            <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">
              {config.wa_phone_number} · ID: {config.wa_account_id}
            </p>
          </div>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 font-display',
            config.is_verified ? 'bg-teal-soft/30 text-teal-deep' : 'bg-red-50 text-red-600'
          )}>
            {config.is_verified ? <><CheckCircle2 size={10} /> Conectado</> : <><XCircle size={10} /> Desconectado</>}
          </span>
        </div>

        {result && (
          <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-body', result === 'ok' ? 'bg-teal-soft/20 text-teal-deep' : 'bg-coral/10 text-coral')}>
            {result === 'ok' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {result === 'ok' ? '✓ WhatsApp conectado correctamente' : '✗ No se pudo conectar con la API.'}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-[var(--outline-variant)]">
          <button
            type="button"
            onClick={() => handleVerify(config.id)}
            disabled={verifying === config.id}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 border-[var(--outline-variant)] font-body"
          >
            {verifying === config.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Reconectar
          </button>
          <button type="button" onClick={() => openEditWa(config)} aria-label={`Editar cuenta ${config.name}`} className="rounded-full border p-1.5 text-navy-light/60 hover:text-navy hover:bg-surface-low transition-colors border-[var(--outline-variant)]">
            <Edit size={13} />
          </button>
          <button type="button" onClick={() => setDeleteTarget(config)} aria-label={`Eliminar cuenta ${config.name}`} className="rounded-full border p-1.5 text-navy-light/60 hover:text-coral hover:bg-coral/5 hover:border-coral/20 transition-colors border-[var(--outline-variant)]">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  // COM-1: gate de la página completa — solo admin.
  if (loaded && !isAdmin) return <AccessDenied />

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-navy px-6 py-5 shadow-[var(--shadow-md)]">
        <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-white/70 font-body">
          Configurá los canales de envío de mensajes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--outline-variant)]">
        {(['smtp', 'whatsapp'] as SmtpTab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-all font-body',
              tab === t ? 'border-coral text-navy' : 'border-transparent text-navy-light/60 hover:text-navy'
            )}
          >
            {t === 'smtp' ? 'SMTP / Correo' : 'WhatsApp'}
          </button>
        ))}
      </div>

      {/* SMTP tab */}
      {tab === 'smtp' && (
        <div className="space-y-4">
          <EmailSection />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-navy-light/60 font-body">
              {smtpConfigs.length} cuenta{smtpConfigs.length !== 1 ? 's' : ''} configurada{smtpConfigs.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => setShowSmtpForm(!showSmtpForm)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all font-body"
            >
              <Plus size={14} />
              Agregar cuenta SMTP
            </button>
          </div>

          {showSmtpForm && (
            <div className="rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-sm font-bold text-navy font-display">Nueva cuenta SMTP</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nombre de la configuración</label>
                  <input aria-label="Nombre de la configuración" className={inputCls} placeholder="ej. Gmail Diana" value={smtpForm.name} onChange={e => setSmtpForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Servidor SMTP</label>
                  <input aria-label="Servidor SMTP" className={inputCls} placeholder="smtp.gmail.com" value={smtpForm.host} onChange={e => setSmtpForm(p => ({ ...p, host: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Puerto</label>
                  <select aria-label="Puerto" className={inputCls} value={smtpForm.port} onChange={e => setSmtpForm(p => ({ ...p, port: e.target.value }))}>
                    <option value="587">587 (TLS)</option>
                    <option value="465">465 (SSL)</option>
                    <option value="25">25 (SMTP)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Usuario</label>
                  <input aria-label="Usuario" className={inputCls} placeholder="usuario@dominio.com" value={smtpForm.user} onChange={e => setSmtpForm(p => ({ ...p, user: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Contraseña</label>
                  <div className="relative">
                    <input
                      aria-label="Contraseña"
                      type={showPwd ? 'text' : 'password'}
                      className={cn(inputCls, 'pr-10')}
                      placeholder="••••••••"
                      value={smtpForm.password}
                      onChange={e => setSmtpForm(p => ({ ...p, password: e.target.value }))}
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-light/60">
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Nombre remitente</label>
                  <input aria-label="Nombre remitente" className={inputCls} placeholder="Theos Place" value={smtpForm.from_name} onChange={e => setSmtpForm(p => ({ ...p, from_name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Email remitente</label>
                  <input aria-label="Email remitente" className={inputCls} placeholder="noreply@theosplace.org" value={smtpForm.from_email} onChange={e => setSmtpForm(p => ({ ...p, from_email: e.target.value }))} />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl bg-surface-low">
                  <div>
                    <p className="text-sm text-navy font-body">Usar SSL/TLS</p>
                    <p className="text-[11px] text-navy-light/60 font-body">Recomendado para mayor seguridad</p>
                  </div>
                  <button type="button" onClick={() => setSmtpForm(p => ({ ...p, ssl: !p.ssl }))} role="switch" aria-checked={smtpForm.ssl} aria-label="Usar SSL/TLS" className={cn('relative h-6 w-11 rounded-full transition-colors', smtpForm.ssl ? 'bg-coral' : 'bg-navy/20')}>
                    <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', smtpForm.ssl ? 'translate-x-5' : 'translate-x-0')} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--outline-variant)]">
                <button type="button" onClick={() => setShowSmtpForm(false)} className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
                <button type="button" onClick={handleAddSmtp} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body">Guardar cuenta</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {smtpConfigs.map(c => <SmtpCard key={c.id} config={c} />)}
          </div>
        </div>
      )}

      {/* WhatsApp tab */}
      {tab === 'whatsapp' && (
        <div className="space-y-4">
          {/* Info notice */}
          <div className="rounded-2xl p-5 flex gap-3 bg-surface-card shadow-[var(--shadow-md)]">
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13px] font-semibold text-navy font-body">
                Para conectar WhatsApp Business API necesitás:
              </p>
              <ol className="text-[12px] text-navy-light/60 space-y-0.5 list-decimal list-inside font-body">
                <li>Una cuenta de Meta Business verificada</li>
                <li>Un número de teléfono dedicado</li>
                <li>El token de acceso de la API de WhatsApp Cloud</li>
              </ol>
              <p className="text-[12px] text-blue-500 mt-2 font-body">
                Más info en: developers.facebook.com/docs/whatsapp
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-navy-light/60 font-body">
              {waConfigs.length} cuenta{waConfigs.length !== 1 ? 's' : ''} configurada{waConfigs.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => setShowWaForm(!showWaForm)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all font-body"
            >
              <Plus size={14} />
              Agregar cuenta WhatsApp
            </button>
          </div>

          {showWaForm && (
            <div className="rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-sm font-bold text-navy font-display">Nueva cuenta WhatsApp Business</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nombre de la configuración</label>
                  <input aria-label="Nombre de la configuración" className={inputCls} placeholder="ej. WhatsApp Theos Norte" value={waForm.name} onChange={e => setWaForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>ID de la cuenta / instancia</label>
                  <input aria-label="ID de la cuenta o instancia" className={inputCls} placeholder="104521839021847" value={waForm.account_id} onChange={e => setWaForm(p => ({ ...p, account_id: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Número de WhatsApp</label>
                  <input aria-label="Número de WhatsApp" className={inputCls} placeholder="+506 8800-0000" value={waForm.phone} onChange={e => setWaForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Token de acceso</label>
                  <div className="relative">
                    <input
                      aria-label="Token de acceso"
                      type={showToken ? 'text' : 'password'}
                      className={cn(inputCls, 'pr-10')}
                      placeholder="EAABs..."
                      value={waForm.token}
                      onChange={e => setWaForm(p => ({ ...p, token: e.target.value }))}
                    />
                    <button type="button" onClick={() => setShowToken(!showToken)} aria-label={showToken ? 'Ocultar token' : 'Mostrar token'} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-light/60">
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--outline-variant)]">
                <button type="button" onClick={() => setShowWaForm(false)} className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
                <button type="button" onClick={handleAddWa} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body">Guardar cuenta</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {waConfigs.map(c => <WaCard key={c.id} config={c} />)}
          </div>
        </div>
      )}
    </div>{/* end space-y-6 */}

    {/* ── Modal: Editar SMTP ── */}
    {editingConfig && editingConfig.type === 'smtp' && (
      <Modal onClose={() => setEditingConfig(null)} titleId="editar-cuenta-smtp" width={512}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)]">
            <p id="editar-cuenta-smtp" className="text-sm font-bold text-navy font-display">Editar cuenta SMTP</p>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre de la configuración</label>
              <input aria-label="Nombre de la configuración" className={inputCls} value={editSmtpForm.name} onChange={e => setEditSmtpForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Servidor SMTP</label>
              <input aria-label="Servidor SMTP" className={inputCls} value={editSmtpForm.host} onChange={e => setEditSmtpForm(p => ({ ...p, host: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Puerto</label>
              <select aria-label="Puerto" className={inputCls} value={editSmtpForm.port} onChange={e => setEditSmtpForm(p => ({ ...p, port: e.target.value }))}>
                <option value="587">587 (TLS)</option><option value="465">465 (SSL)</option><option value="25">25 (SMTP)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Usuario</label>
              <input aria-label="Usuario" className={inputCls} value={editSmtpForm.user} onChange={e => setEditSmtpForm(p => ({ ...p, user: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Contraseña (dejar en blanco para no cambiar)</label>
              <div className="relative">
                <input aria-label="Contraseña" type={showEditPwd ? 'text' : 'password'} className={cn(inputCls, 'pr-10')} placeholder="••••••••" value={editSmtpForm.password} onChange={e => setEditSmtpForm(p => ({ ...p, password: e.target.value }))} />
                <button type="button" onClick={() => setShowEditPwd(v => !v)} aria-label={showEditPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-light/60">
                  {showEditPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Nombre remitente</label>
              <input aria-label="Nombre remitente" className={inputCls} value={editSmtpForm.from_name} onChange={e => setEditSmtpForm(p => ({ ...p, from_name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Email remitente</label>
              <input aria-label="Email remitente" className={inputCls} value={editSmtpForm.from_email} onChange={e => setEditSmtpForm(p => ({ ...p, from_email: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-4 border-t border-[var(--outline-variant)]">
            <button type="button" onClick={() => setEditingConfig(null)} className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
            <button type="button" onClick={handleSaveEditSmtp} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body">Guardar cambios</button>
          </div>
      </Modal>
    )}

    {/* ── Modal: Editar WhatsApp ── */}
    {editingConfig && editingConfig.type === 'whatsapp' && (
      <Modal onClose={() => setEditingConfig(null)} titleId="editar-cuenta-whatsapp" width={448}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)]">
            <p id="editar-cuenta-whatsapp" className="text-sm font-bold text-navy font-display">Editar cuenta WhatsApp</p>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre de la configuración</label>
              <input aria-label="Nombre de la configuración" className={inputCls} value={editWaForm.name} onChange={e => setEditWaForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>ID de la cuenta</label>
              <input aria-label="ID de la cuenta" className={inputCls} value={editWaForm.account_id} onChange={e => setEditWaForm(p => ({ ...p, account_id: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Número de WhatsApp</label>
              <input aria-label="Número de WhatsApp" className={inputCls} value={editWaForm.phone} onChange={e => setEditWaForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Token (dejar en blanco para no cambiar)</label>
              <div className="relative">
                <input aria-label="Token de acceso" type={showEditToken ? 'text' : 'password'} className={cn(inputCls, 'pr-10')} placeholder="EAABs..." value={editWaForm.token} onChange={e => setEditWaForm(p => ({ ...p, token: e.target.value }))} />
                <button type="button" onClick={() => setShowEditToken(v => !v)} aria-label={showEditToken ? 'Ocultar token' : 'Mostrar token'} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-light/60">
                  {showEditToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-4 border-t border-[var(--outline-variant)]">
            <button type="button" onClick={() => setEditingConfig(null)} className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
            <button type="button" onClick={handleSaveEditWa} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body">Guardar cambios</button>
          </div>
      </Modal>
    )}

    <DeleteConfirmModal
      open={!!deleteTarget}
      title="Eliminar configuración"
      description={`Se eliminará la configuración "${deleteTarget?.name ?? ''}". Esta acción no se puede deshacer.`}
      onConfirm={confirmDelete}
      onCancel={() => setDeleteTarget(null)}
    />
    </>
  )
}

/* ── Email (AWS SES vía SMTP) ──
   Las credenciales viven en variables de entorno del servidor (SES_SMTP_*,
   SES_FROM_*), nunca en la BD. Acá solo se muestra el estado, el uso del día
   y un botón de email de prueba. */
function EmailSection() {
  const { user } = useAuth()
  const [status, setStatus] = useState<{ configured: boolean; dailyLimit: number; sentToday: number } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/api/communications/email-status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setStatus(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [reloadKey])

  async function sendTest() {
    if (!user?.email) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/communications/email-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error ?? 'No se pudo enviar')
      setTestResult('ok')
      setReloadKey(k => k + 1)
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : 'No se pudo enviar')
    } finally {
      setTesting(false)
    }
  }

  if (!status) return null

  const pct = status.dailyLimit > 0 ? Math.min(100, Math.round((status.sentToday / status.dailyLimit) * 100)) : 0

  return (
    <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-navy font-body">Email — AWS SES (SMTP)</p>
          <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">
            Proveedor del envío real. Las credenciales se configuran en el servidor
            (variables <code className="font-mono text-[11px]">SES_SMTP_*</code> / <code className="font-mono text-[11px]">SES_FROM_*</code>), nunca en la base de datos.
          </p>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 font-display',
          status.configured ? 'bg-teal-soft/30 text-teal-deep' : 'bg-coral/10 text-coral',
        )}>
          {status.configured ? <><CheckCircle2 size={10} /> Configurado</> : <><XCircle size={10} /> Sin configurar</>}
        </span>
      </div>

      {status.configured ? (
        <>
          {/* Uso del día */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] text-navy-light/70 font-body">
                Hoy: <strong className="text-navy">{status.sentToday}</strong> / {status.dailyLimit} emails enviados
              </p>
              <p className="text-[11px] text-navy-light/60 font-body">
                Límite diario: {status.dailyLimit} (env <code className="font-mono text-[10px]">EMAIL_DAILY_LIMIT</code>)
              </p>
            </div>
            <div className="h-2 rounded-full bg-surface-low overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-coral' : 'bg-teal-deep')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={sendTest}
              disabled={testing || !user?.email}
              className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-[12px] text-white hover:bg-navy-ink transition-colors disabled:opacity-50 font-body"
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {testing ? 'Enviando…' : `Enviar email de prueba a ${user?.email ?? 'tu cuenta'}`}
            </button>
            {testResult === 'ok' && (
              <span className="inline-flex items-center gap-1 text-[12px] text-teal-deep font-body">
                <CheckCircle2 size={13} /> Enviado — revisá tu bandeja
              </span>
            )}
            {testResult && testResult !== 'ok' && (
              <span className="inline-flex items-center gap-1 text-[12px] text-coral font-body">
                <XCircle size={13} /> {testResult}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-coral/7 border border-coral/20 px-4 py-3">
          <p className="text-[13px] text-coral font-body">
            Configurá las variables <code className="font-mono text-[11px]">SES_SMTP_*</code> y <code className="font-mono text-[11px]">SES_FROM_*</code> en el servidor
            (Vercel → Settings → Environment Variables) para habilitar el envío de emails.
            Los envíos están bloqueados hasta entonces.
          </p>
        </div>
      )}
    </div>
  )
}

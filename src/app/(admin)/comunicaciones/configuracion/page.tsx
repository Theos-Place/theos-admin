'use client'

import { useState } from 'react'
import { MOCK_CHANNEL_CONFIGS, type ChannelConfig } from '@/data/mock-communications'
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
} from 'lucide-react'

type SmtpTab = 'smtp' | 'whatsapp'

const INITIAL_SMTP_FORM = {
  name: '', host: '', port: '587', user: '', password: '', from_name: '', from_email: '', ssl: true,
}
const INITIAL_WA_FORM = {
  name: '', account_id: '', token: '', phone: '',
}

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<SmtpTab>('smtp')
  const [configs, setConfigs] = useState<ChannelConfig[]>(MOCK_CHANNEL_CONFIGS)
  const [showSmtpForm, setShowSmtpForm] = useState(false)
  const [showWaForm, setShowWaForm] = useState(false)
  const [smtpForm, setSmtpForm] = useState(INITIAL_SMTP_FORM)
  const [waForm, setWaForm] = useState(INITIAL_WA_FORM)
  const [showPwd, setShowPwd] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<Record<string, 'ok' | 'error'>>({})

  const smtpConfigs = configs.filter(c => c.type === 'smtp')
  const waConfigs = configs.filter(c => c.type === 'whatsapp')

  function handleVerify(id: string) {
    setVerifying(id)
    setTimeout(() => {
      setVerifying(null)
      setVerifyResult(prev => ({ ...prev, [id]: Math.random() > 0.2 ? 'ok' : 'error' }))
    }, 2000)
  }

  function handleDelete(id: string) {
    setConfigs(prev => prev.filter(c => c.id !== id))
  }

  function handleAddSmtp() {
    const newConfig: ChannelConfig = {
      id: `smtp-${Date.now()}`,
      type: 'smtp',
      name: smtpForm.name || 'Nueva cuenta SMTP',
      smtp_host: smtpForm.host,
      smtp_port: parseInt(smtpForm.port),
      smtp_user: smtpForm.user,
      smtp_from_name: smtpForm.from_name,
      smtp_from_email: smtpForm.from_email,
      is_active: true,
      is_verified: false,
      last_verified_at: null,
    }
    setConfigs(prev => [...prev, newConfig])
    setSmtpForm(INITIAL_SMTP_FORM)
    setShowSmtpForm(false)
  }

  function handleAddWa() {
    const newConfig: ChannelConfig = {
      id: `wa-${Date.now()}`,
      type: 'whatsapp',
      name: waForm.name || 'Nueva cuenta WhatsApp',
      wa_account_id: waForm.account_id,
      wa_phone_number: waForm.phone,
      is_active: true,
      is_verified: false,
      last_verified_at: null,
    }
    setConfigs(prev => [...prev, newConfig])
    setWaForm(INITIAL_WA_FORM)
    setShowWaForm(false)
  }

  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'
  const labelCls = 'text-[11px] text-navy-light/50 mb-1 block'

  function SmtpCard({ config }: { config: ChannelConfig }) {
    const result = verifyResult[config.id]
    return (
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-body)' }}>{config.name}</p>
            <p className="text-[12px] text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              {config.smtp_host}:{config.smtp_port} · {config.smtp_user}
            </p>
            <p className="text-[12px] text-navy-light/40 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              De: {config.smtp_from_name} &lt;{config.smtp_from_email}&gt;
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {config.is_verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft/30 px-2.5 py-0.5 text-[10px] font-semibold text-teal-deep" style={{ fontFamily: 'var(--font-display)' }}>
                <CheckCircle2 size={10} /> Verificado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700" style={{ fontFamily: 'var(--font-display)' }}>
                <AlertCircle size={10} /> Sin verificar
              </span>
            )}
          </div>
        </div>

        {result && (
          <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]', result === 'ok' ? 'bg-teal-soft/20 text-teal-deep' : 'bg-coral/10 text-coral')} style={{ fontFamily: 'var(--font-body)' }}>
            {result === 'ok' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {result === 'ok' ? '✓ Conexión exitosa' : '✗ No se pudo conectar. Verificá los datos.'}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
          <button
            type="button"
            onClick={() => handleVerify(config.id)}
            disabled={verifying === config.id}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            {verifying === config.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Verificar
          </button>
          <button type="button" className="rounded-full border p-1.5 text-navy-light/50 hover:text-navy hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)' }}>
            <Edit size={13} />
          </button>
          <button type="button" onClick={() => handleDelete(config.id)} className="rounded-full border p-1.5 text-navy-light/50 hover:text-coral hover:bg-coral/5 hover:border-coral/20 transition-colors" style={{ borderColor: 'var(--outline-variant)' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  function WaCard({ config }: { config: ChannelConfig }) {
    const result = verifyResult[config.id]
    return (
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-body)' }}>{config.name}</p>
            <p className="text-[12px] text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              {config.wa_phone_number} · ID: {config.wa_account_id}
            </p>
          </div>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0',
            config.is_verified ? 'bg-teal-soft/30 text-teal-deep' : 'bg-red-50 text-red-600'
          )} style={{ fontFamily: 'var(--font-display)' }}>
            {config.is_verified ? <><CheckCircle2 size={10} /> Conectado</> : <><XCircle size={10} /> Desconectado</>}
          </span>
        </div>

        {result && (
          <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]', result === 'ok' ? 'bg-teal-soft/20 text-teal-deep' : 'bg-coral/10 text-coral')} style={{ fontFamily: 'var(--font-body)' }}>
            {result === 'ok' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {result === 'ok' ? '✓ WhatsApp conectado correctamente' : '✗ No se pudo conectar con la API.'}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
          <button
            type="button"
            onClick={() => handleVerify(config.id)}
            disabled={verifying === config.id}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            {verifying === config.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Reconectar
          </button>
          <button type="button" className="rounded-full border p-1.5 text-navy-light/50 hover:text-navy hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)' }}>
            <Edit size={13} />
          </button>
          <button type="button" onClick={() => handleDelete(config.id)} className="rounded-full border p-1.5 text-navy-light/50 hover:text-coral hover:bg-coral/5 hover:border-coral/20 transition-colors" style={{ borderColor: 'var(--outline-variant)' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-navy px-6 py-5" style={{ boxShadow: 'var(--shadow-md)' }}>
        <h1 className="text-2xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Configuración
        </h1>
        <p className="mt-1 text-sm text-white/50" style={{ fontFamily: 'var(--font-body)' }}>
          Configurá los canales de envío de mensajes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
        {(['smtp', 'whatsapp'] as SmtpTab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-all',
              tab === t ? 'border-coral text-navy' : 'border-transparent text-navy-light/50 hover:text-navy'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {t === 'smtp' ? 'SMTP / Correo' : 'WhatsApp'}
          </button>
        ))}
      </div>

      {/* SMTP tab */}
      {tab === 'smtp' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              {smtpConfigs.length} cuenta{smtpConfigs.length !== 1 ? 's' : ''} configurada{smtpConfigs.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => setShowSmtpForm(!showSmtpForm)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Plus size={14} />
              Agregar cuenta SMTP
            </button>
          </div>

          {showSmtpForm && (
            <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <p className="text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Nueva cuenta SMTP</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Nombre de la configuración</label>
                  <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="ej. Gmail Diana" value={smtpForm.name} onChange={e => setSmtpForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Servidor SMTP</label>
                  <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="smtp.gmail.com" value={smtpForm.host} onChange={e => setSmtpForm(p => ({ ...p, host: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Puerto</label>
                  <select className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={smtpForm.port} onChange={e => setSmtpForm(p => ({ ...p, port: e.target.value }))}>
                    <option value="587">587 (TLS)</option>
                    <option value="465">465 (SSL)</option>
                    <option value="25">25 (SMTP)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Usuario</label>
                  <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="usuario@dominio.com" value={smtpForm.user} onChange={e => setSmtpForm(p => ({ ...p, user: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className={cn(inputCls, 'pr-10')}
                      style={{ fontFamily: 'var(--font-body)' }}
                      placeholder="••••••••"
                      value={smtpForm.password}
                      onChange={e => setSmtpForm(p => ({ ...p, password: e.target.value }))}
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-light/40">
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Nombre remitente</label>
                  <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="Theos Place" value={smtpForm.from_name} onChange={e => setSmtpForm(p => ({ ...p, from_name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Email remitente</label>
                  <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="noreply@theosplace.org" value={smtpForm.from_email} onChange={e => setSmtpForm(p => ({ ...p, from_email: e.target.value }))} />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface-low)' }}>
                  <div>
                    <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>Usar SSL/TLS</p>
                    <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>Recomendado para mayor seguridad</p>
                  </div>
                  <button type="button" onClick={() => setSmtpForm(p => ({ ...p, ssl: !p.ssl }))} className={cn('relative h-6 w-11 rounded-full transition-colors', smtpForm.ssl ? 'bg-coral' : 'bg-navy/20')}>
                    <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', smtpForm.ssl ? 'translate-x-5' : 'translate-x-0')} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
                <button type="button" onClick={() => setShowSmtpForm(false)} className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>Cancelar</button>
                <button type="button" onClick={handleAddSmtp} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors" style={{ fontFamily: 'var(--font-body)' }}>Guardar cuenta</button>
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
          <div className="rounded-2xl p-5 flex gap-3" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13px] font-semibold text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                Para conectar WhatsApp Business API necesitás:
              </p>
              <ol className="text-[12px] text-navy-light/60 space-y-0.5 list-decimal list-inside" style={{ fontFamily: 'var(--font-body)' }}>
                <li>Una cuenta de Meta Business verificada</li>
                <li>Un número de teléfono dedicado</li>
                <li>El token de acceso de la API de WhatsApp Cloud</li>
              </ol>
              <p className="text-[12px] text-blue-500 mt-2" style={{ fontFamily: 'var(--font-body)' }}>
                Más info en: developers.facebook.com/docs/whatsapp
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              {waConfigs.length} cuenta{waConfigs.length !== 1 ? 's' : ''} configurada{waConfigs.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => setShowWaForm(!showWaForm)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Plus size={14} />
              Agregar cuenta WhatsApp
            </button>
          </div>

          {showWaForm && (
            <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <p className="text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Nueva cuenta WhatsApp Business</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Nombre de la configuración</label>
                  <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="ej. WhatsApp Theos Norte" value={waForm.name} onChange={e => setWaForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>ID de la cuenta / instancia</label>
                  <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="104521839021847" value={waForm.account_id} onChange={e => setWaForm(p => ({ ...p, account_id: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Número de WhatsApp</label>
                  <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="+506 8800-0000" value={waForm.phone} onChange={e => setWaForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} style={{ fontFamily: 'var(--font-body)' }}>Token de acceso</label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      className={cn(inputCls, 'pr-10')}
                      style={{ fontFamily: 'var(--font-body)' }}
                      placeholder="EAABs..."
                      value={waForm.token}
                      onChange={e => setWaForm(p => ({ ...p, token: e.target.value }))}
                    />
                    <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-light/40">
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
                <button type="button" onClick={() => setShowWaForm(false)} className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>Cancelar</button>
                <button type="button" onClick={handleAddWa} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors" style={{ fontFamily: 'var(--font-body)' }}>Guardar cuenta</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {waConfigs.map(c => <WaCard key={c.id} config={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}

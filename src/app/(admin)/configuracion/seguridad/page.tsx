'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Eye, EyeOff, Check, Loader2, AlertCircle,
  Fingerprint, Plus, Trash2, ShieldCheck, Smartphone, Monitor,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOAST_SHORT_MS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { setPasskeySuggestion, clearPasskeySuggestion } from '@/lib/auth/passkey-suggestion'
import type { PasskeyListItem, Factor } from '@supabase/supabase-js'

const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all placeholder:text-navy-light/50',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
  'border-[rgba(22,20,64,0.15)]',
].join(' ')

const LABEL = 'block text-[12px] font-medium text-navy-light/70 mb-1.5 font-body'
const CARD = 'rounded-2xl p-6 space-y-4'
const CARD_STYLE = { background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' } as const
const SECTION_TITLE = 'text-[11px] uppercase tracking-widest text-navy-light/70 font-display'

const REQS = [
  { label: 'Mínimo 8 caracteres',    test: (v: string) => v.length >= 8 },
  { label: 'Al menos una mayúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Al menos un número',     test: (v: string) => /[0-9]/.test(v) },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SeguridadPage() {
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
          Seguridad
        </h1>
        <p className="mt-1 text-sm text-navy-light/70 font-body">
          Gestioná tu contraseña, métodos de acceso y sesiones
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PasswordCard onSave={showToast} />
        <PasskeysCard onSave={showToast} />
        <TotpCard onSave={showToast} />
        <SessionsCard onSave={showToast} />
      </div>

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

/* ── Cambiar contraseña ── */
function PasswordCard({ onSave }: { onSave: (msg: string) => void }) {
  const [newPass, setNewPass]       = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showNew, setShowNew]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmErr, setConfirmErr] = useState('')
  const [error, setError]           = useState('')
  const [saving, setSaving]         = useState(false)

  const reqs = REQS.map(r => ({ ...r, met: r.test(newPass) }))
  const allMet = reqs.every(r => r.met)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPass !== confirm) { setConfirmErr('Las contraseñas no coinciden'); return }
    if (!allMet) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) {
        // 'same_password': Supabase rechaza si la nueva es igual a la actual —
        // no es un problema de sesión, "cerrar sesión y volver a entrar" no lo
        // arregla. El resto sí suele ser sesión vieja (requiere reautenticación).
        setError(
          error.code === 'same_password'
            ? 'La nueva contraseña debe ser diferente a la actual.'
            : 'No se pudo actualizar la contraseña. Cerrá sesión, volvé a ingresar e intentá de nuevo.'
        )
        return
      }
      setNewPass(''); setConfirm('')
      onSave('Contraseña actualizada correctamente')
    } catch {
      setError('No se pudo actualizar la contraseña. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={CARD} style={CARD_STYLE}>
      <p className={SECTION_TITLE}>Cambiar contraseña</p>

      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-coral font-body">
          <AlertCircle size={12} className="shrink-0" /> {error}
        </p>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Nueva contraseña */}
        <div>
          <label className={LABEL}>Nueva contraseña</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="••••••••"
              className={`${INPUT} pr-11 font-body`}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/70 hover:text-navy-light/80" tabIndex={-1}>
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div className="mt-2 space-y-1.5 px-1">
            {reqs.map(req => (
              <div
                key={req.label}
                className="flex items-center gap-2 text-[12px] transition-colors font-body"
                style={{ color: newPass.length === 0 ? 'rgba(41,54,92,0.35)' : req.met ? '#519DA2' : 'rgba(239,85,84,0.7)' }}
              >
                {req.met && newPass.length > 0
                  ? <Check size={12} className="shrink-0" />
                  : <span className="h-3 w-3 rounded-full border shrink-0 border-current inline-block" />}
                {req.label}
              </div>
            ))}
          </div>
        </div>

        {/* Confirmar */}
        <div>
          <label className={LABEL}>Confirmar contraseña</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); if (confirmErr) setConfirmErr('') }}
              onBlur={() => { if (confirm && newPass !== confirm) setConfirmErr('Las contraseñas no coinciden') }}
              placeholder="••••••••"
              className={cn(`${INPUT} pr-11 font-body`, confirmErr ? 'border-coral/50 focus:ring-coral/10' : '')}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/70 hover:text-navy-light/80" tabIndex={-1}>
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {confirmErr && (
            <p className="flex items-center gap-1.5 mt-1.5 text-[12px] text-coral font-body">
              <AlertCircle size={12} className="shrink-0" /> {confirmErr}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !allMet || !confirm}
          className="flex items-center gap-2 rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body"
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Actualizando...</> : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  )
}

/* ── Sección A · Passkeys (huella / Face ID) ── */
function PasskeysCard({ onSave }: { onSave: (msg: string) => void }) {
  const [passkeys, setPasskeys]   = useState<PasskeyListItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [registering, setRegistering] = useState(false)
  const [supported, setSupported] = useState(true)
  const [error, setError]         = useState('')
  const [toDelete, setToDelete]   = useState<PasskeyListItem | null>(null)
  const [deleting, setDeleting]   = useState(false)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.passkey.list()
      if (error) { setError('No se pudieron cargar tus passkeys.'); return }
      setPasskeys(data ?? [])
    } catch {
      setError('No se pudieron cargar tus passkeys.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.PublicKeyCredential) setSupported(false)
    load()
  }, [load])

  async function handleRegister() {
    setError('')
    if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
      setSupported(false)
      setError('Tu dispositivo no soporta passkeys. Podés usarlas desde un dispositivo compatible.')
      return
    }
    setRegistering(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.registerPasskey()
      if (error) { setError('No se pudo registrar la passkey. Intentá de nuevo.'); return }
      setPasskeySuggestion('registered') // ya tiene passkey: no sugerir en el login
      await load()
      onSave('Passkey registrada exitosamente. La próxima vez podés ingresar con tu huella.')
    } catch {
      setError('No se pudo registrar la passkey. Intentá de nuevo.')
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.passkey.delete({ passkeyId: toDelete.id })
      if (error) { setError('No se pudo eliminar la passkey. Intentá de nuevo.'); return }
      const remaining = passkeys.filter(p => p.id !== toDelete.id)
      setPasskeys(remaining)
      // Si quedó sin passkeys, permitimos que el login vuelva a sugerirla.
      if (remaining.length === 0) clearPasskeySuggestion()
      setToDelete(null)
      onSave('Passkey eliminada')
    } catch {
      setError('No se pudo eliminar la passkey. Intentá de nuevo.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={CARD} style={CARD_STYLE}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <p className={SECTION_TITLE}>Passkeys · huella / Face ID</p>
          {!loading && passkeys.length > 0 && (
            <span className="flex items-center gap-1 text-[12px] rounded-full px-2.5 py-0.5 font-medium font-body bg-success/10 text-success">
              <Check size={11} /> Activado
            </span>
          )}
        </div>
        <button
          onClick={handleRegister}
          disabled={registering || !supported}
          className="flex items-center gap-1.5 rounded-xl bg-coral px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body"
        >
          {registering
            ? <><Loader2 size={13} className="animate-spin" /> Registrando...</>
            : <><Plus size={13} /> {passkeys.length > 0 ? 'Agregar passkey' : 'Activar huella / Face ID'}</>}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-coral font-body">
          <AlertCircle size={12} className="shrink-0" /> {error}
        </p>
      )}
      {!supported && !error && (
        <p className="flex items-center gap-1.5 text-[12px] text-navy-light/70 font-body">
          <AlertCircle size={12} className="shrink-0" />
          Tu dispositivo no soporta passkeys. Podés usarlas desde un dispositivo compatible.
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-navy-light/70 py-2 font-body">
          <Loader2 size={14} className="animate-spin" /> Cargando...
        </div>
      ) : passkeys.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4 bg-surface-low">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-teal/12">
            <Fingerprint size={16} className="text-teal-deep" />
          </div>
          <p className="text-[13px] text-navy-light/70 leading-relaxed font-body">
            No tenés passkeys configuradas. Agregá una para ingresar más fácil la próxima vez.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {passkeys.map(pk => (
            <div key={pk.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-surface-low">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-navy/6">
                  <Fingerprint size={15} className="text-navy-light/70" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-navy truncate font-body">
                    {pk.friendly_name?.trim() || 'Passkey sin nombre'}
                  </p>
                  <p className="text-[12px] text-navy-light/70 font-body">Registrada el {fmtDate(pk.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setToDelete(pk)}
                className="flex items-center gap-1 text-[12px] text-coral hover:text-coral-deep transition-colors shrink-0 font-body"
                aria-label="Eliminar passkey"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmModal
        open={toDelete !== null}
        title="Eliminar passkey"
        description={`Vas a eliminar "${toDelete?.friendly_name?.trim() || 'esta passkey'}". No vas a poder usarla para ingresar; tu contraseña sigue funcionando.`}
        keyword="eliminar"
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

/* ── Sección B · Autenticación en dos pasos (TOTP) ── */
function qrSrc(qr: string): string {
  // qr_code viene como SVG (o ya como data URL). Lo normalizamos para <img>.
  if (qr.startsWith('data:')) return qr
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`
}

function TotpCard({ onSave }: { onSave: (msg: string) => void }) {
  const [loading, setLoading]     = useState(true)
  const [factor, setFactor]       = useState<Factor | null>(null)
  const [error, setError]         = useState('')

  // Flujo de enrollment
  const [enroll, setEnroll]       = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [starting, setStarting]   = useState(false)
  const [code, setCode]           = useState('')
  const [verifying, setVerifying] = useState(false)

  // Desactivar
  const [showDisable, setShowDisable] = useState(false)
  const [disabling, setDisabling]     = useState(false)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) { setError('No se pudo cargar el estado de la autenticación en dos pasos.'); return }
      const verified = data?.all?.find(f => f.factor_type === 'totp' && f.status === 'verified') ?? null
      setFactor(verified)
    } catch {
      setError('No se pudo cargar el estado de la autenticación en dos pasos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleStart() {
    setError('')
    setCode('')
    setStarting(true)
    try {
      const supabase = createClient()
      // Si quedó un factor sin verificar de un intento anterior, lo borramos.
      const { data: list } = await supabase.auth.mfa.listFactors()
      const stale = list?.all?.filter(f => f.factor_type === 'totp' && f.status === 'unverified') ?? []
      for (const f of stale) await supabase.auth.mfa.unenroll({ factorId: f.id })

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Theos Place' })
      if (error || !data) { setError('No se pudo iniciar la activación. Intentá de nuevo.'); return }
      setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    } catch {
      setError('No se pudo iniciar la activación. Intentá de nuevo.')
    } finally {
      setStarting(false)
    }
  }

  async function handleVerifyEnroll() {
    if (!enroll || code.length !== 6) return
    setError('')
    setVerifying(true)
    try {
      const supabase = createClient()
      const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.factorId })
      if (challenge.error || !challenge.data) { setError('Código incorrecto. Intentá de nuevo.'); return }
      const { error } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.data.id,
        code,
      })
      if (error) { setError('Código incorrecto. Intentá de nuevo.'); return }
      setEnroll(null)
      setCode('')
      await load()
      onSave('Autenticación en dos pasos activada')
    } catch {
      setError('Código incorrecto. Intentá de nuevo.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleCancelEnroll() {
    const e = enroll
    setEnroll(null)
    setCode('')
    setError('')
    if (e) {
      try {
        const supabase = createClient()
        await supabase.auth.mfa.unenroll({ factorId: e.factorId })
      } catch { /* el factor sin verificar se limpia en el próximo intento */ }
    }
  }

  async function handleDisable() {
    if (!factor) return
    setDisabling(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) { setError('No se pudo desactivar. Intentá de nuevo.'); return }
      setFactor(null)
      setShowDisable(false)
      onSave('Autenticación en dos pasos desactivada')
    } catch {
      setError('No se pudo desactivar. Intentá de nuevo.')
    } finally {
      setDisabling(false)
    }
  }

  return (
    <div className={CARD} style={CARD_STYLE}>
      <p className={SECTION_TITLE}>Autenticación en dos pasos</p>

      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-coral font-body">
          <AlertCircle size={12} className="shrink-0" /> {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-navy-light/70 py-2 font-body">
          <Loader2 size={14} className="animate-spin" /> Cargando...
        </div>
      ) : factor ? (
        /* ── Ya configurado ── */
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-success/12">
                <ShieldCheck size={16} className="text-success" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-navy font-body">
                    {factor.friendly_name?.trim() || 'App de autenticación'}
                  </p>
                  <span className="text-[12px] rounded-full px-2.5 py-0.5 font-medium font-body bg-success/10 text-success">
                    Activa
                  </span>
                </div>
                <p className="text-[12px] text-navy-light/70 mt-0.5 font-body">
                  Activada el {fmtDate(factor.updated_at || factor.created_at)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDisable(true)}
              className="text-[12px] text-coral hover:text-coral-deep transition-colors shrink-0 font-body"
            >
              Desactivar
            </button>
          </div>
        </div>
      ) : enroll ? (
        /* ── Flujo de activación ── */
        <div className="space-y-4">
          <p className="text-[13px] text-navy-light/70 leading-relaxed font-body">
            Escaneá este código QR con Google Authenticator, Authy, 1Password o Apple Keychain.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="rounded-2xl bg-white p-3 shrink-0 border border-outline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc(enroll.qr)} alt="Código QR para configurar la autenticación en dos pasos" width={160} height={160} />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-[12px] uppercase tracking-widest text-navy-light/70 mb-1 font-display">¿No podés escanear?</p>
                <p className="text-[12px] text-navy-light/70 mb-1.5 font-body">Ingresá este código manualmente:</p>
                <code className="block rounded-xl bg-surface-low px-3 py-2.5 text-[13px] text-navy break-all font-mono select-all">
                  {enroll.secret}
                </code>
              </div>
              <div>
                <label className={LABEL}>Código de 6 dígitos</label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                  className={`${INPUT} tracking-[0.4em] text-center font-mono`}
                  onKeyDown={e => { if (e.key === 'Enter' && code.length === 6 && !verifying) handleVerifyEnroll() }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleVerifyEnroll}
                  disabled={verifying || code.length !== 6}
                  className="flex items-center gap-2 rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body"
                >
                  {verifying ? <><Loader2 size={14} className="animate-spin" /> Verificando...</> : 'Verificar y activar'}
                </button>
                <button
                  onClick={handleCancelEnroll}
                  disabled={verifying}
                  className="rounded-xl border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-all disabled:opacity-50 font-body border-outline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── No configurado ── */
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl px-4 py-4 bg-surface-low">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-navy/6">
              <Shield size={16} className="text-navy-light/70" />
            </div>
            <p className="text-[13px] text-navy-light/70 leading-relaxed font-body">
              Agregá una capa extra de seguridad pidiendo un código de tu app de autenticación
              (Google Authenticator, Authy, 1Password) cada vez que ingresás.
            </p>
          </div>
          <button
            onClick={handleStart}
            disabled={starting}
            className="flex items-center gap-2 rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral-deep transition-all disabled:opacity-50 font-body"
          >
            {starting ? <><Loader2 size={14} className="animate-spin" /> Preparando...</> : 'Activar autenticación en dos pasos'}
          </button>
        </div>
      )}

      <DeleteConfirmModal
        open={showDisable}
        title="Desactivar autenticación en dos pasos"
        description="Vas a quitar el segundo factor. Tu cuenta quedará protegida solo con contraseña. Podés volver a activarlo cuando quieras."
        keyword="desactivar"
        confirmLabel="Desactivar"
        loading={disabling}
        onConfirm={handleDisable}
        onCancel={() => setShowDisable(false)}
      />
    </div>
  )
}

/* ── Sección C · Sesiones activas ── */
function SessionsCard({ onSave }: { onSave: (msg: string) => void }) {
  const [closing, setClosing] = useState(false)

  async function handleCloseOthers() {
    setClosing(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'others' })
      onSave('Se cerraron las demás sesiones')
    } catch {
      onSave('No se pudieron cerrar las otras sesiones')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className={CARD} style={CARD_STYLE}>
      <p className={SECTION_TITLE}>Sesiones activas</p>

      <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-surface-low">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-navy/6">
            <Monitor size={15} className="text-navy-light/70" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-navy font-body">Este dispositivo</p>
            <p className="text-[12px] text-navy-light/70 font-body">Sesión actual</p>
          </div>
        </div>
        <span className="text-[12px] rounded-full px-2.5 py-1 font-medium font-body bg-success/10 text-success">
          Esta sesión
        </span>
      </div>

      <p className="flex items-start gap-1.5 text-[12px] text-navy-light/70 font-body">
        <Smartphone size={13} className="shrink-0 mt-0.5" />
        Si ingresaste desde otro dispositivo y querés revocar ese acceso, cerrá las demás sesiones.
      </p>

      <button
        onClick={handleCloseOthers}
        disabled={closing}
        className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] text-navy-light hover:bg-surface-low transition-all disabled:opacity-50 font-body border-outline"
      >
        {closing ? <><Loader2 size={13} className="animate-spin" /> Cerrando...</> : 'Cerrar todas las otras sesiones'}
      </button>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Check, KeyRound, Loader2, Mail, UserCheck, UserX, UserPlus, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime } from '@/lib/format'
import { InviteToStudyButton } from '@/components/studies/InviteToStudyButton'
import { StudyExceptionButton } from '@/components/studies/StudyExceptionButton'
import { MemberRecommendations } from './MemberRecommendations'

type AdminData = {
  approved_to_lead_studies: boolean
  approved_at: string | null
  approved_by_name: string | null
  can_edit: boolean
}

type AccountStatus = {
  state: 'none' | 'unconfirmed' | 'active'
  linked: boolean
  email: string | null
  email_confirmed_at: string | null
  last_sign_in_at: string | null
}

/** Tab "Administrativo": SOLO roles administrativos (el miembro nunca lo ve, ni
 *  el tab ni los datos). Acciones de estudios + "Aprobado para dar estudios" +
 *  recomendaciones de cierres (todas). */
export function MemberAdminTab({ memberId }: { memberId: string }) {
  const [admin, setAdmin] = useState<AdminData | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [account, setAccount] = useState<AccountStatus | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [resendBusy, setResendBusy] = useState(false)
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [createBusy, setCreateBusy] = useState(false)
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadAccount = useCallback(() => {
    setAccountLoading(true)
    return fetch(`/api/members/${memberId}/account-status`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: AccountStatus) => setAccount(d))
      .catch(() => setAccount(null))
      .finally(() => setAccountLoading(false))
  }, [memberId])

  useEffect(() => { loadAccount() }, [loadAccount])

  async function createAccount() {
    if (createBusy) return
    setCreateBusy(true)
    setCreateMsg(null)
    try {
      const res = await fetch(`/api/members/${memberId}/create-account`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear la cuenta.')
      setCreateMsg({ ok: true, text: `Cuenta creada y correo de activación enviado a ${data?.email ?? account?.email ?? 'su correo'}.` })
      await loadAccount()
    } catch (e) {
      setCreateMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo crear la cuenta.' })
    } finally {
      setCreateBusy(false)
    }
  }

  async function resendActivation() {
    if (resendBusy) return
    setResendBusy(true)
    setResendMsg(null)
    try {
      const res = await fetch(`/api/members/${memberId}/resend-activation`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo reenviar el correo.')
      setResendMsg({ ok: true, text: `Correo de activación reenviado a ${data?.email ?? account?.email ?? 'su correo'}.` })
    } catch (e) {
      setResendMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo reenviar el correo.' })
    } finally {
      setResendBusy(false)
    }
  }

  const loadAdmin = useCallback(() => {
    return fetch(`/api/members/${memberId}/admin-data`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: AdminData) => setAdmin(d))
      .catch(() => setError('No se pudieron cargar los datos administrativos.'))
  }, [memberId])

  useEffect(() => { loadAdmin() }, [loadAdmin])

  async function toggleApproved() {
    if (!admin || busy || !admin.can_edit) return
    setBusy(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/members/${memberId}/admin-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_to_lead_studies: !admin.approved_to_lead_studies }),
      })
      if (!res.ok) throw new Error()
      await loadAdmin()
      setSaved(true)
    } catch {
      setError('No se pudo actualizar la aprobación.')
    } finally {
      setBusy(false)
    }
  }

  async function sendPasswordReset() {
    if (pwBusy) return
    setPwBusy(true)
    setPwMsg(null)
    try {
      const res = await fetch(`/api/members/${memberId}/password-reset`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el correo.')
      setPwMsg({ ok: true, text: 'Correo de restablecimiento enviado.' })
    } catch (e) {
      setPwMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo enviar el correo.' })
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Cuenta y acceso */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={15} className="text-navy-light/70" />
          <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display">Cuenta y acceso</p>
        </div>

        {accountLoading ? (
          <p className="text-[12px] text-navy-light/60 font-body inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Consultando estado de la cuenta…</p>
        ) : !account || account.state === 'none' ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-low px-3 py-1.5">
              <UserX size={14} className="text-navy-light/60" />
              <span className="text-[12px] text-navy-light/70 font-body">Este miembro no tiene cuenta de acceso.</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={createAccount}
                disabled={createBusy || !account?.email}
                title={!account?.email ? 'El miembro no tiene correo registrado.' : undefined}
                className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[13px] text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
              >
                {createBusy ? <><Loader2 size={14} className="animate-spin" /> Creando…</> : <><UserPlus size={14} /> Crear cuenta de acceso</>}
              </button>
              {!account?.email && (
                <span className="text-[11px] text-navy-light/60 font-body">Requiere un correo registrado en el perfil.</span>
              )}
            </div>
            <p className="text-[11px] text-navy-light/60 font-body">
              Crea el usuario de acceso y le envía el correo de activación (Supabase Auth) a su correo registrado.
            </p>
            {createMsg && (
              <p className={`text-[12px] font-body inline-flex items-center gap-1 ${createMsg.ok ? 'text-teal-deep' : 'text-coral'}`}>
                {createMsg.ok && <Check size={12} />}{createMsg.text}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Indicador de estado */}
            <div className="flex items-center gap-2 flex-wrap">
              {account.state === 'active' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft/30 px-3 py-1 text-[12px] font-medium text-teal-deep font-body">
                  <UserCheck size={13} /> Cuenta activada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[12px] font-medium text-amber-700 font-body">
                  <Clock size={13} /> Cuenta sin activar
                </span>
              )}
              {account.email && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-navy-light/70 font-body">
                  <Mail size={13} className="text-navy-light/50" /> {account.email}
                </span>
              )}
            </div>

            {/* Detalle de fechas */}
            <div className="text-[11px] text-navy-light/60 font-body space-y-0.5">
              {account.state === 'active' && account.email_confirmed_at && (
                <p>Activada el {formatDate(account.email_confirmed_at)}</p>
              )}
              {account.last_sign_in_at
                ? <p>Último acceso: {formatDateTime(account.last_sign_in_at)}</p>
                : account.state === 'active' && <p>Sin accesos registrados todavía.</p>}
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {account.state === 'unconfirmed' && (
                <button
                  type="button"
                  onClick={resendActivation}
                  disabled={resendBusy}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 border-[var(--outline-variant)] font-body"
                >
                  {resendBusy ? <><Loader2 size={14} className="animate-spin" /> Reenviando…</> : <><Mail size={14} /> Reenviar correo de activación</>}
                </button>
              )}
              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={pwBusy}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 border-[var(--outline-variant)] font-body"
              >
                {pwBusy ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : <><KeyRound size={14} /> Enviar enlace de restablecer contraseña</>}
              </button>
            </div>

            {resendMsg && (
              <p className={`text-[12px] font-body inline-flex items-center gap-1 ${resendMsg.ok ? 'text-teal-deep' : 'text-coral'}`}>
                {resendMsg.ok && <Check size={12} />}{resendMsg.text}
              </p>
            )}
            {pwMsg && (
              <p className={`text-[12px] font-body inline-flex items-center gap-1 ${pwMsg.ok ? 'text-teal-deep' : 'text-coral'}`}>
                {pwMsg.ok && <Check size={12} />}{pwMsg.text}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Acciones de estudios (movidas desde Participación) */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display mb-3">Acciones de estudios</p>
        <div className="flex gap-2 flex-wrap">
          <InviteToStudyButton memberId={memberId} />
          <StudyExceptionButton memberId={memberId} />
        </div>
      </div>

      {/* Aprobado para dar estudios */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={15} className="text-teal-deep" />
          <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display">Aprobación para dar estudios</p>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-navy font-body">Aprobado para dar estudios</p>
            <p className="text-[12px] text-navy-light/70 mt-0.5 font-body">
              {admin?.can_edit ? 'Habilita a esta persona como dirigente de estudios.' : 'Solo coordinación de estudios o admin puede cambiarlo.'}
            </p>
            {admin?.approved_to_lead_studies && admin.approved_by_name && (
              <p className="text-[11px] text-navy-light/60 mt-1 font-body">
                Aprobado por {admin.approved_by_name}{admin.approved_at ? ` · ${formatDate(admin.approved_at)}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!admin?.approved_to_lead_studies}
            disabled={!admin?.can_edit || busy}
            onClick={toggleApproved}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5',
              admin?.approved_to_lead_studies ? 'bg-coral' : 'bg-navy/20',
              (!admin?.can_edit || busy) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', admin?.approved_to_lead_studies ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
        {saved && <p className="text-[12px] text-teal-deep mt-2 font-body inline-flex items-center gap-1"><Check size={12} /> Guardado</p>}
        {error && <p className="text-[12px] text-coral mt-2 font-body">{error}</p>}
      </div>

      {/* Recomendaciones (todas, para roles administrativos) */}
      <MemberRecommendations memberId={memberId} />
    </div>
  )
}

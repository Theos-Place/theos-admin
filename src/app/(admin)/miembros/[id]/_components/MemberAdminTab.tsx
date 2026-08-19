'use client'

import { useState, useEffect, useCallback } from 'react'
import { Ban, BookOpen, Check, GraduationCap, KeyRound, Loader2, Mail, UserCheck, UserX, UserPlus, Clock, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime } from '@/lib/format'
import { InviteToStudyButton } from '@/components/studies/InviteToStudyButton'
import { StudyExceptionButton } from '@/components/studies/StudyExceptionButton'
import { MemberRecommendations, PersonaLink } from './MemberRecommendations'
import { ACTION_PLAN_OPTIONS, COMMITMENT_OPTIONS, needsFollowUp } from '@/lib/studies/premat-evaluation'
import {
  SCALE_LABELS, RECOMMENDATION_OPTIONS, CONVICTION_TOPICS, CONVICTION_STANCES,
  TESTIMONY_LABEL, BIBLE_LABEL, SPEECH_LABEL,
} from '@/lib/studies/cdeb-recommendation'
import { ACCOUNT_STATE_LABEL, ACCOUNT_STATE_ACTION, type AccountState } from '@/lib/members/account-state'

type AdminData = {
  can_view_studies: boolean
  not_recommended_to_lead_studies: boolean
  marked_at: string | null
  marked_by_name: string | null
  not_recommended_reason: string | null
  can_edit: boolean
  authorized_virtual_studies: boolean
  authorized_virtual_studies_at: string | null
  authorized_virtual_studies_by_name: string | null
  can_edit_virtual: boolean
  servers_onboarding: boolean
  servers_onboarding_at: string | null
  servers_onboarding_by_name: string | null
  can_edit_onboarding: boolean
}

type AccountStatus = {
  state: AccountState
  linked: boolean
  email: string | null
  email_confirmed_at: string | null
  last_sign_in_at: string | null
}

/** Tab "Administrativo": SOLO roles administrativos (el miembro nunca lo ve, ni
 *  el tab ni los datos). Acciones de estudios + "No recomendado para dar
 *  estudios" (lista de excepciones, no de aprobados) + recomendaciones de
 *  cierres (todas). */
export function MemberAdminTab({ memberId }: { memberId: string }) {
  const [admin, setAdmin] = useState<AdminData | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyVirtual, setBusyVirtual] = useState(false)
  const [savedVirtual, setSavedVirtual] = useState(false)
  const [errorVirtual, setErrorVirtual] = useState<string | null>(null)
  const [busyOnboarding, setBusyOnboarding] = useState(false)
  const [savedOnboarding, setSavedOnboarding] = useState(false)
  const [errorOnboarding, setErrorOnboarding] = useState<string | null>(null)
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
      setCreateMsg({ ok: true, text: `Cuenta creada e instrucciones enviadas a ${data?.email ?? account?.email ?? 'su correo'}.` })
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
      setResendMsg({ ok: true, text: `Instrucciones enviadas a ${data?.email ?? account?.email ?? 'su correo'}.` })
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

  // Marcar exige justificación: el toggle no activa directo — abre el textbox
  // y se confirma con la razón (la fecha la sella el API sola).
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')

  async function saveNotRecommended(value: boolean, reasonText?: string) {
    if (!admin || busy || !admin.can_edit) return
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}/admin-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ not_recommended_to_lead_studies: value, ...(value ? { reason: reasonText } : {}) }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
      await loadAdmin()
      setReasonOpen(false)
      setReason('')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo actualizar la marca.')
    } finally {
      setBusy(false)
    }
  }

  function toggleNotRecommended() {
    if (!admin || busy || !admin.can_edit) return
    if (admin.not_recommended_to_lead_studies) {
      void saveNotRecommended(false) // desmarcar no pide razón
    } else if (reasonOpen) {
      setReasonOpen(false) // segundo toque sin confirmar = cancelar
      setReason('')
    } else {
      setReasonOpen(true)
    }
  }

  async function toggleVirtualAuth() {
    if (!admin || busyVirtual || !admin.can_edit_virtual) return
    setBusyVirtual(true)
    setSavedVirtual(false)
    try {
      const res = await fetch(`/api/members/${memberId}/admin-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorized_virtual_studies: !admin.authorized_virtual_studies }),
      })
      if (!res.ok) throw new Error()
      await loadAdmin()
      setSavedVirtual(true)
    } catch {
      setErrorVirtual('No se pudo actualizar la autorización.')
    } finally {
      setBusyVirtual(false)
    }
  }

  async function toggleOnboarding() {
    if (!admin || busyOnboarding || !admin.can_edit_onboarding) return
    setBusyOnboarding(true)
    setSavedOnboarding(false)
    try {
      const res = await fetch(`/api/members/${memberId}/admin-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers_onboarding: !admin.servers_onboarding }),
      })
      if (!res.ok) throw new Error()
      await loadAdmin()
      setSavedOnboarding(true)
    } catch {
      setErrorOnboarding('No se pudo actualizar el onboarding.')
    } finally {
      setBusyOnboarding(false)
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
      setPwMsg({ ok: true, text: 'Instrucciones para recuperar el acceso enviadas.' })
    } catch (e) {
      setPwMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo enviar el correo.' })
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Todo lo de estudios/cuenta SOLO para roles de estudios; los encargados
          de servidores entran al tab únicamente por su sección de onboarding. */}
      {admin?.can_view_studies && <>
      {/* Cuenta y acceso */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={15} className="text-navy-light/80" />
          <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">Cuenta y acceso</p>
        </div>

        {accountLoading ? (
          <p className="text-[13px] text-navy-light/80 font-body inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Consultando estado de la cuenta…</p>
        ) : !account || account.state === 'none' ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-low px-3 py-1.5">
              <UserX size={14} className="text-navy-light/80" />
              <span className="text-[13px] text-navy-light/80 font-body">Este miembro no tiene cuenta de acceso.</span>
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
                <span className="text-[13px] text-navy-light/80 font-body">Requiere un correo registrado en el perfil.</span>
              )}
            </div>
            <p className="text-[13px] text-navy-light/80 font-body">
              Crea el usuario de acceso y le manda el correo con el paso a paso para crear su contraseña. El correo NO lleva un enlace que venza: la persona lo pide desde la pantalla de ingreso cuando lo va a usar.
            </p>
            {createMsg && (
              <p className={`text-[13px] font-body inline-flex items-center gap-1 ${createMsg.ok ? 'text-teal-deep' : 'text-coral'}`}>
                {createMsg.ok && <Check size={12} />}{createMsg.text}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Indicador de estado */}
            <div className="flex items-center gap-2 flex-wrap">
              {account.state === 'active' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft/30 px-3 py-1 text-[13px] font-medium text-teal-deep font-body">
                  <UserCheck size={13} /> {ACCOUNT_STATE_LABEL.active}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[13px] font-medium text-amber-700 font-body">
                  <Clock size={13} /> {ACCOUNT_STATE_LABEL.never_entered}
                </span>
              )}
              {account.email && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body">
                  <Mail size={13} className="text-navy-light/50" /> {account.email}
                </span>
              )}
            </div>

            {/* Detalle de fechas */}
            <div className="text-[13px] text-navy-light/80 font-body space-y-0.5">
              {account.email_confirmed_at && (
                <p>Contraseña definida el {formatDate(account.email_confirmed_at)}</p>
              )}
              {account.last_sign_in_at
                ? <p>Último acceso: {formatDateTime(account.last_sign_in_at)}</p>
                : <p>{ACCOUNT_STATE_ACTION.never_entered}</p>}
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {account.state === 'never_entered' && (
                <button
                  type="button"
                  onClick={resendActivation}
                  disabled={resendBusy}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 border-[var(--outline-variant)] font-body"
                >
                  {resendBusy ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : <><Mail size={14} /> Enviar instrucciones para entrar</>}
                </button>
              )}
              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={pwBusy}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 border-[var(--outline-variant)] font-body"
              >
                {pwBusy ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : <><KeyRound size={14} /> Enviar instrucciones para recuperar el acceso</>}
              </button>
            </div>

            {resendMsg && (
              <p className={`text-[13px] font-body inline-flex items-center gap-1 ${resendMsg.ok ? 'text-teal-deep' : 'text-coral'}`}>
                {resendMsg.ok && <Check size={12} />}{resendMsg.text}
              </p>
            )}
            {pwMsg && (
              <p className={`text-[13px] font-body inline-flex items-center gap-1 ${pwMsg.ok ? 'text-teal-deep' : 'text-coral'}`}>
                {pwMsg.ok && <Check size={12} />}{pwMsg.text}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Estudios — administrativo: acciones, excepciones y autorizaciones,
          todo en una sola tarjeta (pedido 2026-08-19). */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={15} className="text-teal-deep" />
          <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">Estudios — administrativo</p>
        </div>

        {/* Acciones de estudios (movidas desde Participación) */}
        <div className="pb-4 border-b border-[var(--outline-variant)]">
          <p className="text-[13px] text-navy-light/80 font-display mb-2">Acciones de estudios</p>
          <div className="flex gap-2 flex-wrap">
            <InviteToStudyButton memberId={memberId} blocked={!!admin?.not_recommended_to_lead_studies} />
            <StudyExceptionButton memberId={memberId} />
          </div>
        </div>

        {/* No recomendado para dar estudios (lista de excepciones — nadie
            marcado por defecto) */}
        <div className="py-4 border-b border-[var(--outline-variant)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
          <Ban size={15} className="text-coral mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-navy font-body">No recomendado para dar estudios</p>
            <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">
              {admin?.can_edit
                ? 'Marca a esta persona para que no reciba invitación a la formación de dirigentes (CDEB).'
                : 'Solo coordinación de estudios o admin puede cambiarlo.'}
            </p>
            {admin?.not_recommended_to_lead_studies && admin.marked_by_name && (
              <p className="text-[13px] text-navy-light/80 mt-1 font-body">
                Marcado por {admin.marked_by_name}{admin.marked_at ? ` · ${formatDate(admin.marked_at)}` : ''}
              </p>
            )}
            {admin?.not_recommended_to_lead_studies && admin.not_recommended_reason && (
              <p className="text-[13px] text-navy-light/80 mt-1 font-body">
                Razón: “{admin.not_recommended_reason}”
              </p>
            )}
          </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!admin?.not_recommended_to_lead_studies}
            aria-label="No recomendado para dar estudios"
            disabled={!admin?.can_edit || busy}
            onClick={toggleNotRecommended}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5',
              admin?.not_recommended_to_lead_studies ? 'bg-coral' : 'bg-navy/20',
              (!admin?.can_edit || busy) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', admin?.not_recommended_to_lead_studies ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
        {/* Justificación obligatoria antes de confirmar la marca */}
        {reasonOpen && !admin?.not_recommended_to_lead_studies && (
          <div className="mt-3 space-y-2">
            <label htmlFor="not-recommended-reason" className="block text-[13px] font-medium text-navy-light/80 font-body">
              Razón (obligatoria) — la fecha se guarda automáticamente
            </label>
            <textarea
              id="not-recommended-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="¿Por qué no debe recibir la invitación a CDEB?"
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body placeholder:text-navy-light/50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveNotRecommended(true, reason)}
                disabled={!reason.trim() || busy}
                className={cn('rounded-full bg-coral px-4 py-1.5 text-[13px] text-white hover:bg-coral-deep transition-colors font-body inline-flex items-center gap-1.5', (!reason.trim() || busy) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={13} className="animate-spin" /> Guardando…</> : 'Marcar'}
              </button>
              <button
                type="button"
                onClick={() => { setReasonOpen(false); setReason('') }}
                disabled={busy}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {saved && <p className="text-[13px] text-teal-deep mt-2 font-body inline-flex items-center gap-1"><Check size={12} /> Guardado</p>}
        {error && <p className="text-[13px] text-coral mt-2 font-body">{error}</p>}
        </div>

        {/* Autorizado para estudios virtuales */}
        <div className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
          <Video size={15} className="text-teal-deep mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-navy font-body">Autorizado para estudios virtuales</p>
            <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">
              {admin?.can_edit_virtual ? 'Habilita a esta persona a ver y matricularse en grupos virtuales.' : 'Solo coordinación de estudios, coordinación de dirigentes o admin puede cambiarlo.'}
            </p>
            {admin?.authorized_virtual_studies && admin.authorized_virtual_studies_by_name && (
              <p className="text-[13px] text-navy-light/80 mt-1 font-body">
                Autorizado por {admin.authorized_virtual_studies_by_name}{admin.authorized_virtual_studies_at ? ` · ${formatDate(admin.authorized_virtual_studies_at)}` : ''}
              </p>
            )}
          </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!admin?.authorized_virtual_studies}
            aria-label="Autorizado para estudios virtuales"
            disabled={!admin?.can_edit_virtual || busyVirtual}
            onClick={toggleVirtualAuth}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5',
              admin?.authorized_virtual_studies ? 'bg-coral' : 'bg-navy/20',
              (!admin?.can_edit_virtual || busyVirtual) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', admin?.authorized_virtual_studies ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
        {savedVirtual && <p className="text-[13px] text-teal-deep mt-2 font-body inline-flex items-center gap-1"><Check size={12} /> Guardado</p>}
        {errorVirtual && <p className="text-[13px] text-coral mt-2 font-body">{errorVirtual}</p>}
        </div>
      </div>
      </>}

      {/* Onboarding de servidores: SOLO admin y encargados de servidores */}
      {admin?.can_edit_onboarding && (
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={15} className="text-teal-deep" />
          <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">Servidores</p>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-navy font-body">
              Llevó el onboarding de servidores
              {admin?.servers_onboarding && admin.servers_onboarding_at && (
                <span className="ml-2 rounded-full bg-teal-soft/30 px-2 py-0.5 text-[13px] font-semibold text-teal-deep font-display">
                  {formatDate(admin.servers_onboarding_at)}
                </span>
              )}
            </p>
            <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">
              Al marcarlo se guarda automáticamente la fecha.
            </p>
            {admin?.servers_onboarding && admin.servers_onboarding_by_name && (
              <p className="text-[13px] text-navy-light/80 mt-1 font-body">
                Marcado por {admin.servers_onboarding_by_name}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!admin?.servers_onboarding}
            aria-label="Llevó el onboarding de servidores"
            disabled={!admin?.can_edit_onboarding || busyOnboarding}
            onClick={toggleOnboarding}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5',
              admin?.servers_onboarding ? 'bg-coral' : 'bg-navy/20',
              (!admin?.can_edit_onboarding || busyOnboarding) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', admin?.servers_onboarding ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
        {savedOnboarding && <p className="text-[13px] text-teal-deep mt-2 font-body inline-flex items-center gap-1"><Check size={12} /> Guardado</p>}
        {errorOnboarding && <p className="text-[13px] text-coral mt-2 font-body">{errorOnboarding}</p>}
      </div>
      )}

      {/* Recomendaciones (todas, para roles administrativos de estudios) */}
      {admin?.can_view_studies && <MemberRecommendations memberId={memberId} />}

      {/* PRE-8: evaluación del prematrimonial (pastoral). El endpoint gatea a
          coordinador_estudios/direccion/admin — con 403 la sección no aparece
          (coordinador_dirigentes ve este tab pero NO esta información). */}
      {admin?.can_view_studies && <PrematEvaluationPanel memberId={memberId} />}

      {/* EST-9: recomendaciones a CDEB. Gate en el API: coordinador_dirigentes,
          coordinador_estudios y admin — NI el propio miembro, NI el dirigente
          que la escribió, NI dirección (con 403 no se pinta). */}
      {admin?.can_view_studies && <CdebRecommendationsPanel memberId={memberId} />}
    </div>
  )
}

// ─── PRE-8: evaluación del curso prematrimonial (solo lectura) ───────────────
type EvalRow = {
  id: string
  commitment: string
  strengths: string[]
  strengths_notes: string | null
  topics_to_work: string[]
  observations: string | null
  blind_spot: boolean
  blind_spot_notes: string | null
  action_plan: string
  blessing: string | null
  created_at: string
}

function PrematEvaluationPanel({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<EvalRow[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/studies/prematrimonial/evaluations?member_id=${memberId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setRows(d?.items ?? []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [memberId])

  if (!rows || rows.length === 0) return null

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
      <div>
        <h3 className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Evaluación del prematrimonial</h3>
        <p className="mt-1 text-[13px] text-navy-light/80 font-body">
          Información pastoral confidencial: visible solo para coordinación de estudios, dirección y admin. No la ve el miembro ni su pareja.
        </p>
      </div>
      {rows.map(e => {
        const plan = ACTION_PLAN_OPTIONS.find(o => o.value === e.action_plan)
        const commitment = COMMITMENT_OPTIONS.find(o => o.value === e.commitment)
        return (
          <div key={e.id} className="rounded-xl border border-outline p-4 space-y-2 text-[13px] font-body">
            <div className="flex items-center justify-between gap-2">
              <span className="text-navy-light/80">{formatDate(e.created_at)}</span>
              {needsFollowUp(e.action_plan) && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[13px] font-semibold text-amber-800 font-display">⚑ En seguimiento</span>
              )}
            </div>
            <p className="text-navy"><strong>Plan de acción:</strong> {plan?.label ?? e.action_plan}</p>
            <p className="text-navy-light/80"><strong className="text-navy">Compromiso:</strong> {commitment?.label ?? e.commitment}</p>
            {e.strengths.length > 0 && <p className="text-navy-light/80"><strong className="text-navy">Fortalezas:</strong> {e.strengths.join(' · ')}</p>}
            {e.strengths_notes && <p className="text-navy-light/80">{e.strengths_notes}</p>}
            {e.topics_to_work.length > 0 && <p className="text-navy-light/80"><strong className="text-navy">A profundizar:</strong> {e.topics_to_work.join(' · ')}</p>}
            {e.observations && <p className="text-navy-light/80 whitespace-pre-line"><strong className="text-navy">Observaciones:</strong> {e.observations}</p>}
            {e.blind_spot && (
              <p className="rounded-lg bg-coral/5 px-3 py-2 text-coral-deep">
                <strong>Punto ciego / tema no resuelto:</strong> {e.blind_spot_notes ?? '(sin descripción)'}
              </p>
            )}
            {e.blessing && <p className="text-navy-light/80 whitespace-pre-line"><strong className="text-navy">Bendición:</strong> {e.blessing}</p>}
          </div>
        )
      })}
    </div>
  )
}

// ─── EST-9: recomendaciones a CDEB (solo lectura, gate en el API) ────────────
type CdebRow = {
  id: string
  status: string
  completion_date: string | null
  convictions: Array<{ topic: string; stance: string; notes?: string | null }>
  testimony_score: string | null
  testimony_notes: string | null
  passion_score: string | null
  passion_notes: string | null
  bible_knowledge_score: string | null
  speech_score: string | null
  speech_notes: string | null
  commitment_notes: string | null
  committee_notes: string | null
  recommendation: string | null
  recommended_prior_study: string | null
  created_at: string
  group?: { name: string | null; plan?: { code: string | null } | null } | null
  /** member_id de quien la escribió (se enlaza a su perfil). */
  filled_by?: string | null
  leader?: { first_name: string; last_name: string } | null
}

function CdebRecommendationsPanel({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<CdebRow[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/studies/cdeb-recommendations?member_id=${memberId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setRows(d?.items ?? []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [memberId])

  if (!rows || rows.length === 0) return null

  const scale = (v: string | null) => (v ? `${v === 'x' ? 'X' : v} · ${SCALE_LABELS[v] ?? ''}` : '—')

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
      <div>
        <h3 className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Evaluación para la formación de dirigentes (CDEB)</h3>
        <p className="mt-1 text-[13px] text-navy-light/80 font-body">
          Evaluación de dirigentes para el comité. Confidencial: no la ve el miembro ni quien la escribió.
        </p>
      </div>
      {rows.map(r => {
        const rec = RECOMMENDATION_OPTIONS.find(o => o.value === r.recommendation)
        const leader = r.leader ? `${r.leader.first_name} ${r.leader.last_name}`.trim() : null
        return (
          <div key={r.id} className="rounded-xl border border-outline p-4 space-y-2 text-[13px] font-body">
            {/* Quién la hizo va primero y con nombre propio: antes iba corrido
                entre el plan y el grupo, en gris, y se leía como parte del
                nombre del grupo (2026-08-05). */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-navy">
                La hizo {leader
                  ? <PersonaLink id={r.filled_by ?? null} nombre={leader} />
                  : <strong>un dirigente</strong>}
              </p>
              <span className="text-[13px] text-navy-light/80">{formatDate(r.created_at)}</span>
            </div>
            <p className="text-[13px] text-navy-light/80">
              Al cerrar {r.group?.plan?.code ?? 'el grupo'}{r.group?.name ? ` · ${r.group.name}` : ''}
            </p>
            <p className="text-navy"><strong>Recomendación:</strong> {rec?.label ?? r.recommendation ?? '—'}
              {r.recommendation === 'si_otro_estudio' && r.recommended_prior_study && (
                <span> — primero: <strong>{r.recommended_prior_study}</strong></span>
              )}
            </p>
            <p className="text-navy-light/80">
              <strong className="text-navy">{TESTIMONY_LABEL}:</strong> {scale(r.testimony_score)}
              {' · '}<strong className="text-navy">Pasión:</strong> {scale(r.passion_score)}
              {' · '}<strong className="text-navy">{BIBLE_LABEL}:</strong> {scale(r.bible_knowledge_score)}
              {' · '}<strong className="text-navy">{SPEECH_LABEL}:</strong> {scale(r.speech_score)}
            </p>
            {r.testimony_notes && <p className="text-navy-light/80 whitespace-pre-line"><strong className="text-navy">Testimonio:</strong> {r.testimony_notes}</p>}
            {r.passion_notes && <p className="text-navy-light/80 whitespace-pre-line"><strong className="text-navy">Comparte su fe:</strong> {r.passion_notes}</p>}
            {r.speech_notes && <p className="text-navy-light/80 whitespace-pre-line"><strong className="text-navy">Expresión:</strong> {r.speech_notes}</p>}
            {r.commitment_notes && <p className="text-navy-light/80 whitespace-pre-line"><strong className="text-navy">Compromiso:</strong> {r.commitment_notes}</p>}
            {r.convictions?.length > 0 && (
              <div className="rounded-lg bg-coral/5 px-3 py-2 space-y-1">
                <p className="text-coral-deep font-semibold">Convicciones a trabajar</p>
                {r.convictions.map((c, i) => (
                  <p key={i} className="text-coral-deep">
                    · {CONVICTION_TOPICS.find(t => t.value === c.topic)?.label ?? c.topic}
                    {' — '}{CONVICTION_STANCES.find(sx => sx.value === c.stance)?.label ?? c.stance}
                    {c.notes ? `: ${c.notes}` : ''}
                  </p>
                ))}
              </div>
            )}
            {r.committee_notes && <p className="text-navy-light/80 whitespace-pre-line"><strong className="text-navy">Para el comité:</strong> {r.committee_notes}</p>}
          </div>
        )
      })}
    </div>
  )
}

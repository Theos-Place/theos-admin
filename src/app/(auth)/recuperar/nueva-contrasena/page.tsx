'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, Loader2, CheckCircle, Check, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readAuthLinkError, authLinkMessage, type AuthLinkMessage } from '@/lib/auth/link-error'
import type { SupabaseClient } from '@supabase/supabase-js'

const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all',
  'placeholder:text-navy-light/80',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
].join(' ')

interface Req { label: string; test: (v: string) => boolean }
const REQUIREMENTS: Req[] = [
  { label: 'Mínimo 8 caracteres',    test: v => v.length >= 8 },
  { label: 'Al menos una mayúscula', test: v => /[A-Z]/.test(v) },
  { label: 'Al menos un número',     test: v => /[0-9]/.test(v) },
]

export default function NuevaContrasenaPage() {
  const router = useRouter()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmErr, setConfirmErr] = useState('')
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)
  const [submitErr, setSubmitErr]   = useState('')
  // null = verificando el link; true = sesión de recuperación válida; false = inválido/expirado.
  const [recoveryReady, setRecoveryReady] = useState<boolean | null>(null)
  // Se muestra de QUIÉN es la cuenta: si alguien abre el enlace donde había otra
  // sesión, tiene que ver claro a quién le está cambiando la contraseña.
  const [email, setEmail] = useState<string | null>(null)
  // Motivo real del fallo (Supabase lo manda en el fragmento de la URL): sirve
  // para no decirle "enlace inválido" a quien simplemente ya lo usó.
  const [linkMsg, setLinkMsg] = useState<AuthLinkMessage | null>(null)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  // Supabase establece una sesión temporal de recuperación al abrir el link del
  // correo (token en la URL → evento PASSWORD_RECOVERY). Si no hay sesión tras
  // un momento, el link expiró o es inválido.
  useEffect(() => {
    let alive = true
    const supabase = createClient()
    supabaseRef.current = supabase

    // getUser() (no getSession): pregunta al servidor con la cookie actual, así
    // no se confunde con una sesión vieja cacheada de otra cuenta en el mismo
    // navegador — ver el bug del correo viejo en /completar-perfil.
    supabase.auth.getUser().then(({ data, error }) => {
      if (alive && data.user && !error) { setRecoveryReady(true); setEmail(data.user.email ?? null) }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setRecoveryReady(true)
        setEmail(session?.user?.email ?? null)
      }
    })
    // Margen para que el client procese el token de la URL antes de declarar inválido.
    const t = setTimeout(() => {
      if (!alive) return
      setRecoveryReady(prev => (prev === null ? false : prev))
      setLinkMsg(authLinkMessage(readAuthLinkError(window.location), 'recuperacion'))
    }, 2500)

    return () => { alive = false; sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  const reqs = REQUIREMENTS.map(r => ({ ...r, met: r.test(password) }))
  const allReqsMet = reqs.every(r => r.met)

  function handleConfirmBlur() {
    setConfirmErr(confirm && password !== confirm ? 'Las contraseñas no coinciden' : '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allReqsMet || !confirm) return
    if (password !== confirm) { setConfirmErr('Las contraseñas no coinciden'); return }
    setLoading(true)
    setSubmitErr('')
    try {
      const supabase = supabaseRef.current ?? createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        // Mensaje real de Supabase (contraseña débil/filtrada, link expirado, etc.).
        setSubmitErr(error.message || 'No se pudo actualizar la contraseña.')
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 1800)
    } catch {
      setSubmitErr('No se pudo actualizar la contraseña. El enlace pudo expirar; solicitá uno nuevo.')
      setLoading(false)
    }
  }

  // ── Verificando el link ──
  if (recoveryReady === null) {
    return (
      <div className="w-full max-w-[400px] text-center py-10">
        <Loader2 size={22} className="animate-spin text-navy-light/80 mx-auto mb-3" />
        <p className="text-sm text-navy-light/80 font-body">Verificando el enlace…</p>
      </div>
    )
  }

  // ── Link expirado / inválido ──
  if (recoveryReady === false) {
    return (
      <div className="w-full max-w-[400px] text-center">
        <div className="flex justify-center mb-5">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-coral/10">
            <AlertCircle size={28} className="text-coral" />
          </div>
        </div>
        <h2 className="text-2xl text-navy mb-3 font-display font-extrabold tracking-[-0.025em]">
          {linkMsg?.titulo ?? 'Este enlace ya se usó o venció'}
        </h2>
        <p className="text-sm text-navy-light/80 leading-relaxed mb-8 font-body">
          {linkMsg?.detalle ?? 'Los enlaces sirven una sola vez. Si ya cambiaste tu contraseña, entrá con la nueva.'}
        </p>
        <div className="space-y-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all bg-coral hover:bg-coral-deep font-body shadow-[0_8px_24px_rgba(239,85,84,0.28)]"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/recuperar"
            className="inline-flex items-center justify-center w-full rounded-xl border border-[var(--outline-variant)] py-3.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Pedir un enlace nuevo
          </Link>
        </div>
      </div>
    )
  }

  // ── Éxito ──
  if (done) {
    return (
      <div className="w-full text-center max-w-[400px]" style={{ animation: 'fadeIn 0.35s ease-out' }}>
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div className="flex justify-center mb-5">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-[rgba(112,189,194,0.15)]">
            <CheckCircle size={28} className="text-teal-deep" />
          </div>
        </div>
        <h2 className="text-2xl text-navy mb-3 font-display font-extrabold tracking-[-0.025em]">Contraseña actualizada</h2>
        <p className="text-sm text-navy-light/80 leading-relaxed mb-8 font-body">
          Tu contraseña fue cambiada exitosamente. Te llevamos al login…
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all bg-coral hover:bg-coral-deep font-body shadow-[0_8px_24px_rgba(239,85,84,0.28)]"
        >
          Ir al login
        </Link>
      </div>
    )
  }

  // ── Formulario de nueva contraseña ──
  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-8">
        <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-5 bg-[rgba(22,20,64,0.06)]">
          <Lock size={20} className="text-navy-light/80" />
        </div>
        <h1 className="text-3xl text-navy mb-2 font-display font-extrabold tracking-[-0.025em]">Creá tu nueva contraseña</h1>
        <p className="text-[13px] text-navy-light/80 font-body">
          Elegí una contraseña segura{email ? ' para ' : '.'}
          {email && <span className="font-medium text-navy">{email}</span>}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="nueva-contrasena" className="block text-[13px] font-medium text-navy-light/80 mb-1.5 font-body">Nueva contraseña</label>
          <div className="relative">
            <input id="nueva-contrasena"
              type={showPass ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${INPUT} pr-11 border-[rgba(22,20,64,0.15)] font-body`}
            />
            <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/80 hover:text-navy-light/80 transition-colors" tabIndex={-1}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5 px-1">
          {reqs.map(req => (
            <div key={req.label} className="flex items-center gap-2 text-[13px] transition-all duration-200 font-body" style={{ color: password.length === 0 ? 'rgba(41,54,92,0.35)' : req.met ? '#3B7579' : 'rgba(239,85,84,0.7)' }}>
              {req.met && password.length > 0 ? <Check size={12} className="shrink-0" /> : <span className="h-3 w-3 rounded-full border shrink-0 border-current inline-block" />}
              {req.label}
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="confirmar-contrasena" className="block text-[13px] font-medium text-navy-light/80 mb-1.5 font-body">Confirmar contraseña</label>
          <div className="relative">
            <input id="confirmar-contrasena"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); if (confirmErr) setConfirmErr('') }}
              onBlur={handleConfirmBlur}
              placeholder="••••••••"
              className={`${INPUT} pr-11 font-body ${confirmErr ? 'border-coral/50 focus:border-coral/60 focus:ring-coral/10' : 'border-[rgba(22,20,64,0.15)]'}`}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/80 hover:text-navy-light/80 transition-colors" tabIndex={-1}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirmErr && (
            <p className="flex items-center gap-1.5 mt-1.5 text-[13px] text-coral font-body"><AlertCircle size={12} className="shrink-0" /> {confirmErr}</p>
          )}
        </div>

        {submitErr && (
          <p className="flex items-center gap-1.5 text-[13px] text-coral font-body"><AlertCircle size={12} className="shrink-0" /> {submitErr}</p>
        )}

        <button
          type="submit"
          disabled={loading || !allReqsMet || !confirm}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-coral hover:bg-coral-deep font-body"
          style={{ boxShadow: (!loading && allReqsMet && confirm) ? '0 8px 24px rgba(239,85,84,0.28)' : 'none' }}
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, Loader2, Fingerprint, ShieldCheck, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { shouldSuggestPasskey } from '@/lib/auth/passkey-suggestion'
import { PasskeySuggestionModal } from '@/components/auth/PasskeySuggestionModal'

function isEmail(value: string): boolean {
  return value.includes('@')
}

const LABEL = 'block text-[12px] font-medium text-navy-light/60 mb-1.5'
const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all',
  'placeholder:text-navy-light/50',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
].join(' ')
const INPUT_ERROR = 'border-coral/50 focus:border-coral/60 focus:ring-coral/10'
const INPUT_NORMAL = 'border-[rgba(22,20,64,0.15)]'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail]             = useState('')  // correo o cédula
  const [password, setPassword]       = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [rememberMe, setRememberMe]   = useState(false)
  const [loading, setLoading]         = useState(false)
  const [authError, setAuthError]     = useState('')
  const [emailErr, setEmailErr]       = useState('')
  const [passErr, setPassErr]         = useState('')

  // Passkeys: solo mostramos el botón si el dispositivo soporta WebAuthn con
  // autenticador de plataforma (huella / Face ID). Si no, queda oculto en
  // silencio y el usuario sigue con email/password normal.
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [passkeyLoading, setPasskeyLoading]     = useState(false)

  // MFA (TOTP): cuando el usuario tiene segundo factor, mostramos esta pantalla
  // inline en vez de redirigir. factorId se resuelve tras el login con password.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode]         = useState('')
  const [mfaLoading, setMfaLoading]   = useState(false)
  const [mfaError, setMfaError]       = useState('')

  // Sugerencia de passkey tras el primer login (solo si aplica).
  const [showPasskeyModal, setShowPasskeyModal] = useState(false)

  function goToDashboard() {
    router.push('/dashboard')
    router.refresh()
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return
    window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false))
  }, [])

  async function handlePasskey() {
    setAuthError('')
    setPasskeyLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPasskey()
      if (error) {
        setAuthError('No se pudo autenticar con huella. Intentá con tu contraseña.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setAuthError('No se pudo autenticar con huella. Intentá con tu contraseña.')
    } finally {
      setPasskeyLoading(false)
    }
  }

  function validate() {
    let ok = true
    if (!email.trim()) {
      setEmailErr('Ingresá tu correo o cédula'); ok = false
    } else if (isEmail(email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr('El formato del correo no es válido'); ok = false
    } else {
      setEmailErr('')
    }
    if (!password) {
      setPassErr('Ingresá tu contraseña'); ok = false
    } else {
      setPassErr('')
    }
    return ok
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.trim(), password }),
      })
      if (!res.ok) {
        setAuthError(res.status === 429
          ? 'Demasiados intentos. Esperá un momento y volvé a intentar.'
          : 'Correo o cédula o contraseña incorrectos. Verificá tus datos e intentá de nuevo.')
        return
      }

      // Login con password OK. Verificamos si el usuario tiene un segundo factor
      // (TOTP) pendiente: la sesión queda en aal1 con nextLevel aal2.
      const supabase = createClient()
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.[0] ?? factors?.all?.find(f => f.factor_type === 'totp' && f.status === 'verified')
        if (totp) {
          setMfaFactorId(totp.id)
          return // mostramos la pantalla de verificación inline
        }
      }

      // Sin MFA pendiente: ofrecemos configurar passkey si corresponde.
      if (await shouldSuggestPasskey()) {
        setShowPasskeyModal(true)
        return
      }

      goToDashboard()
    } catch {
      setAuthError('No se pudo conectar. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyMfa(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaFactorId || mfaCode.length !== 6) return
    setMfaError('')
    setMfaLoading(true)
    try {
      const supabase = createClient()
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challenge.error || !challenge.data) {
        setMfaError('Código incorrecto. Intentá de nuevo.')
        return
      }
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code: mfaCode,
      })
      if (error) {
        setMfaError('Código incorrecto. Intentá de nuevo.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setMfaError('Código incorrecto. Intentá de nuevo.')
    } finally {
      setMfaLoading(false)
    }
  }

  // Volver al login con email/password: cerramos la sesión aal1 a medio camino.
  async function handleMfaBack() {
    setMfaError('')
    setMfaCode('')
    setMfaFactorId(null)
    setPassword('')
    try {
      await createClient().auth.signOut()
    } catch { /* sin sesión que cerrar */ }
  }

  // ── Pantalla de verificación MFA (segundo factor TOTP) ──
  if (mfaFactorId) {
    return (
      <div className="w-full max-w-[400px]">
        <div className="mb-8">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4 bg-teal/12">
            <ShieldCheck size={22} className="text-teal-deep" />
          </div>
          <h1 className="text-3xl text-navy mb-2 font-display font-extrabold tracking-[-0.025em]">
            Verificación en dos pasos
          </h1>
          <p className="text-sm text-navy-light/60 leading-relaxed font-body">
            Ingresá el código de tu app de autenticación
          </p>
        </div>

        {mfaError && (
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-6 text-[13px] text-coral-deep bg-[rgba(239,85,84,0.07)] border border-[rgba(239,85,84,0.2)] font-body">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            {mfaError}
          </div>
        )}

        <form onSubmit={handleVerifyMfa} className="space-y-4">
          <div>
            <label htmlFor="mfa-code" className={`${LABEL} font-body`}>
              Código de 6 dígitos
            </label>
            <input
              id="mfa-code"
              value={mfaCode}
              onChange={e => { setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (mfaError) setMfaError('') }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              autoFocus
              className={`${INPUT} ${INPUT_NORMAL} font-mono text-center tracking-[0.4em]`}
            />
          </div>

          <button
            type="submit"
            disabled={mfaLoading || mfaCode.length !== 6}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all font-body disabled:opacity-50 bg-coral hover:bg-coral-deep"
            style={{
              boxShadow: mfaLoading ? 'none' : '0 8px 24px rgba(239,85,84,0.30)',
              cursor: mfaLoading || mfaCode.length !== 6 ? 'not-allowed' : 'pointer',
            }}
          >
            {mfaLoading ? <><Loader2 size={16} className="animate-spin" /> Verificando...</> : 'Verificar'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleMfaBack}
          className="mt-5 mx-auto flex items-center gap-1.5 text-[13px] text-navy-light/60 hover:text-navy transition-colors font-body"
        >
          <ArrowLeft size={14} /> Volver al inicio de sesión
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px]">

      {showPasskeyModal && <PasskeySuggestionModal onDone={goToDashboard} />}

      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl text-navy mb-2 font-display font-extrabold tracking-[-0.025em]"
        >
          Bienvenido de vuelta
        </h1>
        <p className="text-sm text-navy-light/60 leading-relaxed font-body">
          Ingresá tu correo y contraseña para<br />
          acceder al sistema administrativo.
        </p>
      </div>

      {/* Auth error banner */}
      {authError && (
        <div
          className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-6 text-[13px] text-coral-deep bg-[rgba(239,85,84,0.07)] border border-[rgba(239,85,84,0.2)] font-body"
        >
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {authError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        {/* Correo */}
        <div>
          <label htmlFor="login-identifier" className={`${LABEL} font-body`}>
            Correo electrónico o cédula
          </label>
          <input
            id="login-identifier"
            type="text"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            placeholder="ejemplo@correo.com o 1-0384-0921"
            className={`${INPUT} font-body ${emailErr ? INPUT_ERROR : INPUT_NORMAL}`}
          />
          {emailErr && (
            <p className="flex items-center gap-1.5 mt-1.5 text-[12px] text-coral font-body">
              <AlertCircle size={12} className="shrink-0" />
              {emailErr}
            </p>
          )}
        </div>

        {/* Contraseña */}
        <div>
          <label htmlFor="login-password" className={`${LABEL} font-body`}>
            Contraseña
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); if (passErr) setPassErr('') }}
              placeholder="••••••••"
              className={`${INPUT} pr-11 font-body ${passErr ? INPUT_ERROR : INPUT_NORMAL}`}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/60 hover:text-navy-light/80 transition-colors"
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passErr && (
            <p className="flex items-center gap-1.5 mt-1.5 text-[12px] text-coral font-body">
              <AlertCircle size={12} className="shrink-0" />
              {passErr}
            </p>
          )}
        </div>

        {/* Recordarme */}
        <label className="flex items-center gap-2.5 cursor-pointer w-fit">
          <div
            className="relative flex items-center"
            onClick={() => setRememberMe(v => !v)}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={() => {}}
              className="sr-only"
            />
            <div
              className={`h-4 w-4 rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-coral' : 'bg-white'}`}
              style={{
                border: rememberMe ? 'none' : '1.5px solid rgba(22,20,64,0.25)',
              }}
            >
              {rememberMe && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
          <span className="text-[13px] text-navy-light/60 select-none font-body">
            Recordarme
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all font-body bg-coral hover:bg-coral-deep disabled:opacity-50"
          style={{
            boxShadow: loading ? 'none' : '0 8px 24px rgba(239,85,84,0.30)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Ingresando...
            </>
          ) : 'Iniciar sesión'}
        </button>
      </form>

      {/* Passkey: opción secundaria, solo si el dispositivo la soporta */}
      {passkeySupported && (
        <>
          {/* Separador ── o ── */}
          <div className="flex items-center gap-3 my-5">
            <span className="h-px flex-1 bg-[rgba(22,20,64,0.12)]" />
            <span className="text-[12px] text-navy-light/60 font-body select-none">o</span>
            <span className="h-px flex-1 bg-[rgba(22,20,64,0.12)]" />
          </div>

          <button
            type="button"
            onClick={handlePasskey}
            disabled={passkeyLoading || loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-navy/20 bg-white py-3.5 text-sm font-semibold text-navy transition-all hover:bg-navy/[0.03] font-body"
            style={{ cursor: passkeyLoading || loading ? 'not-allowed' : 'pointer' }}
          >
            {passkeyLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Autenticando...
              </>
            ) : (
              <>
                <Fingerprint size={18} />
                Ingresar con huella / Face ID
              </>
            )}
          </button>
        </>
      )}

      {/* Recuperar */}
      <p className="mt-5 text-center text-[13px] text-navy-light/60 font-body">
        ¿Olvidaste tu contraseña?{' '}
        <Link href="/recuperar" className="text-navy-light hover:text-navy font-medium transition-colors">
          Recuperar acceso →
        </Link>
      </p>

      {/* Legal */}
      <p className="mt-6 text-center text-[13px] text-navy-light/70 font-body">
        <Link href="/terminos" className="hover:text-navy transition-colors">
          Términos y Condiciones y Política de Privacidad
        </Link>
      </p>

    </div>
  )
}

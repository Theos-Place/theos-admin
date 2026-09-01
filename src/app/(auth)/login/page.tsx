'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fieldA11y } from '@/lib/forms/field-a11y'
import { Eye, EyeOff, AlertCircle, Loader2, Fingerprint, ShieldCheck, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { shouldSuggestPasskey } from '@/lib/auth/passkey-suggestion'
import { CUENTA_DESACTIVADA, MENSAJE_CUENTA_DESACTIVADA } from '@/lib/auth/account-active'
import { PasskeySuggestionModal } from '@/components/auth/PasskeySuggestionModal'
import { safeDest, DEFAULT_DEST } from '@/lib/auth/redirect-target'

function isEmail(value: string): boolean {
  return value.includes('@')
}

const LABEL = 'block text-[13px] font-medium text-navy-light/80 mb-1.5'
const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all',
  'placeholder:text-navy-light/80',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
].join(' ')
const INPUT_ERROR = 'border-coral/50 focus:border-coral/60 focus:ring-coral/10'
const INPUT_NORMAL = 'border-[rgba(22,20,64,0.15)]'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail]             = useState('')  // correo o cédula
  const [password, setPassword]       = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [authError, setAuthError]     = useState('')

  // ?motivo=cuenta_desactivada — lo pone AuthProvider al cerrarle la sesión a
  // una ficha dada de baja.
  //
  // Con useSyncExternalStore y no con un useEffect+setState: leer la URL es
  // justamente "leer una fuente externa", y así no hay estado que sincronizar
  // ni render en cascada. Tampoco con useSearchParams, que obligaría a meter
  // toda la pantalla de ingreso en un Suspense por un banner.
  const motivo = useSyncExternalStore(
    () => () => {},                                              // la URL no cambia sola acá
    () => new URLSearchParams(window.location.search).get('motivo'),
    () => null,                                                  // en el servidor no hay URL
  )
  const avisoBaja = motivo === CUENTA_DESACTIVADA ? MENSAJE_CUENTA_DESACTIVADA : ''
  const [emailErr, setEmailErr]       = useState('')
  const [passErr, setPassErr]         = useState('')
  // AUD-1 · aria-invalid + aria-describedby. `id` explícito para NO cambiar los
  // ids: el navegador y el gestor de contraseñas se acuerdan del campo por su id.
  const a11yEmail = fieldA11y('correo', emailErr, { required: true, id: 'login-identifier' })
  const a11yPass  = fieldA11y('contrasena', passErr, { required: true, id: 'login-password' })

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

  // Destino post-login: respeta ?redirect si es un path interno seguro (evita
  // open-redirect), si no cae al dashboard. Lo pone el middleware cuando manda
  // al login desde una ruta protegida, y también el login-gate de /vacantes.
  //
  // La validación vive en lib/auth/redirect-target (la misma que usa el
  // middleware para construirlo): un solo criterio de qué destino se acepta.
  //
  // Lee de window.location.search a propósito: la verificación de MFA ocurre
  // INLINE en esta misma página, así que la URL —y con ella el ?redirect=— no
  // cambia entre la contraseña y el segundo factor.
  function postLoginDest(): string {
    if (typeof window === 'undefined') return DEFAULT_DEST
    return safeDest(new URLSearchParams(window.location.search).get('redirect'))
  }

  function goToDashboard() {
    router.push(postLoginDest())
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
      router.push(postLoginDest())
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
      router.push(postLoginDest())
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
          <p className="text-sm text-navy-light/80 leading-relaxed font-body">
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
          className="mt-5 mx-auto flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-navy transition-colors font-body"
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
          Bienvenido
        </h1>
        <p className="text-sm text-navy-light/80 leading-relaxed font-body">
          Ingresá tu correo y contraseña para acceder al sistema
          administrativo de Theos.
        </p>
      </div>

      {/* AUD-1 · Los aria del campo (invalid + describedby) salen de fieldA11y,
          que respeta los ids existentes para no romper el autocompletado. */}
      {/* Auth error banner */}
      {(authError || avisoBaja) && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-6 text-[13px] text-coral-deep bg-[rgba(239,85,84,0.07)] border border-[rgba(239,85,84,0.2)] font-body"
        >
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {authError || avisoBaja}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        {/* Correo */}
        <div>
          <label htmlFor="login-identifier" className={`${LABEL} font-body`}>
            Correo electrónico o cédula
          </label>
          <input
            {...a11yEmail.input}
            type="text"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            placeholder="ejemplo@correo.com o 1-0384-0921"
            className={`${INPUT} font-body ${emailErr ? INPUT_ERROR : INPUT_NORMAL}`}
          />
          {emailErr && (
            <p {...a11yEmail.error} className="flex items-center gap-1.5 mt-1.5 text-[13px] text-coral font-body">
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
              {...a11yPass.input}
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
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/80 hover:text-navy-light/80 transition-colors"
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passErr && (
            <p {...a11yPass.error} className="flex items-center gap-1.5 mt-1.5 text-[13px] text-coral font-body">
              <AlertCircle size={12} className="shrink-0" />
              {passErr}
            </p>
          )}
        </div>

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
            <span className="text-[13px] text-navy-light/80 font-body select-none">o</span>
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

      {/* UN SOLO enlace para "no puedo entrar" (2026-09-01). Antes eran dos
          —"primera vez" y "olvidé mi contraseña"— que iban al MISMO flujo de
          recuperación, solo con distinto copy. Dos enlaces al mismo lugar
          obligan a decidir algo que no cambia nada, y desde que existe el
          registro público "primera vez" además se confundía con crear cuenta.

          El que sí es una decisión de verdad —tengo perfil vs. no tengo— quedó
          abajo, con su propio texto. */}
      <div className="mt-5 rounded-xl border border-teal-deep/25 bg-teal-soft/15 px-4 py-3 text-center">
        <p className="text-[13px] text-navy font-body">
          ¿Primera vez en la nueva plataforma u olvidaste tu contraseña?{' '}
          <Link href="/recuperar" className="font-semibold text-teal-deep hover:underline">
            Restablecé tu contraseña →
          </Link>
        </p>
      </div>

      {/* Registro público: para quien NO está en el padrón. Va SEPARADO del
          "creá tu contraseña", que es para quien ya tiene ficha — confundir los
          dos es lo que hace que alguien termine con dos fichas. */}
      <p className="mt-4 text-center text-[13px] text-navy-light/80 font-body">
        ¿Nuevo en Theos y todavía no tenés perfil?{' '}
        <Link href="/registro" className="font-semibold text-teal-deep hover:underline">
          Registrate acá →
        </Link>
      </p>

      {/* Ayuda: pública, se lee SIN sesión (el tutorial de crear la contraseña
          está ahí, así que tiene que abrirse desde acá). */}
      <p className="mt-4 text-center text-[13px] text-navy-light/80 font-body">
        ¿No sabés cómo entrar?{' '}
        <Link href="/ayuda" className="text-teal-deep hover:underline font-medium">
          Mirá el centro de ayuda →
        </Link>
      </p>


      {/* Legal */}
      <p className="mt-6 text-center text-[13px] text-navy-light/80 font-body">
        <Link href="/terminos" className="hover:text-navy transition-colors">
          Términos y Condiciones y Política de Privacidad
        </Link>
      </p>

    </div>
  )
}

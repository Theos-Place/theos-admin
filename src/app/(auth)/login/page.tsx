'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

function isEmail(value: string): boolean {
  return value.includes('@')
}

const LABEL = 'block text-[12px] font-medium text-navy-light/60 mb-1.5'
const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all',
  'placeholder:text-navy-light/25',
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
        setAuthError('Correo o cédula o contraseña incorrectos. Verificá tus datos e intentá de nuevo.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setAuthError('No se pudo conectar. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[400px]">

      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl text-navy mb-2 font-display font-extrabold tracking-[-0.025em]"
        >
          Bienvenido de vuelta
        </h1>
        <p className="text-sm text-navy-light/50 leading-relaxed font-body">
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
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/30 hover:text-navy-light/60 transition-colors"
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
              className="h-4 w-4 rounded flex items-center justify-center transition-all"
              style={{
                border: rememberMe ? 'none' : '1.5px solid rgba(22,20,64,0.25)',
                background: rememberMe ? '#EF5554' : 'white',
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
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all font-body"
          style={{
            background: loading ? '#c0453a' : '#EF5554',
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

      {/* Recuperar */}
      <p className="mt-5 text-center text-[13px] text-navy-light/50 font-body">
        ¿Olvidaste tu contraseña?{' '}
        <Link href="/recuperar" className="text-navy-light hover:text-navy font-medium transition-colors">
          Recuperar acceso →
        </Link>
      </p>

    </div>
  )
}

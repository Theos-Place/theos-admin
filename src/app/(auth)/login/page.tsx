'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, Loader2, Zap } from 'lucide-react'

const MOCK_USERS = [
  { email: 'admin@theosplace.org',     cedula: '1-0000-0001', password: 'Theos2026',    roles: ['admin'],            name: 'Admin Theos',     member_id: 'uuid-0001'  },
  { email: 'finanzas@theosplace.org',  cedula: '1-0000-0002', password: 'finanzas123',  roles: ['finanzas'],         name: 'Jennifer Zamora', member_id: 'custom-001' },
  { email: 'staff@theosplace.org',     cedula: '1-0000-0003', password: 'staff123',     roles: ['encargado_staff'],  name: 'Carlos Araya',    member_id: 'custom-002' },
  { email: 'dirigente@theosplace.org', cedula: '1-0000-0004', password: 'dirigente123', roles: ['dirigente'],        name: 'Diego Salazar',   member_id: 'mock-member-4' },
  { email: 'miembro@theosplace.org',   cedula: '1-0000-0005', password: 'miembro123',   roles: ['miembro'],          name: 'María Rodríguez', member_id: 'mock-member-5' },
]

function isEmail(value: string): boolean {
  return value.includes('@')
}

function normalizeCedula(value: string): string {
  return value.replace(/[-\s]/g, '')
}

async function mockLogin(identifier: string, password: string) {
  await new Promise(resolve => setTimeout(resolve, 1200))
  const user = MOCK_USERS.find(u => {
    const idMatch = isEmail(identifier)
      ? u.email === identifier.toLowerCase().trim()
      : normalizeCedula(u.cedula) === normalizeCedula(identifier)
    return idMatch && u.password === password
  })
  if (!user) throw new Error('Credenciales incorrectas')
  return user
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
  const [showMagic, setShowMagic]     = useState(false)
  const [magicToken, setMagicToken]   = useState('')
  const [magicLoading, setMagicLoading] = useState(false)

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
      const user = await mockLogin(email.trim(), password)
      const userData = { name: user.name, email: user.email, role: user.roles[0], roles: user.roles, member_id: user.member_id }
      const storage = rememberMe ? localStorage : sessionStorage
      storage.setItem('theos_user', JSON.stringify(userData))
      const age = rememberMe ? 60 * 60 * 24 * 30 : 86400
      document.cookie = `theos_session=true; path=/; max-age=${age}`
      router.push('/dashboard')
    } catch {
      setAuthError('Correo o contraseña incorrectos. Verificá tus datos e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!magicToken.trim()) return
    setMagicLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    sessionStorage.setItem('theos_user', JSON.stringify({ name: 'Usuario', email: email || 'usuario@theosplace.org', role: 'staff_leader' }))
    document.cookie = 'theos_session=true; path=/; max-age=86400'
    router.push('/dashboard')
  }

  return (
    <div className="w-full" style={{ maxWidth: 400 }}>

      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl text-navy mb-2"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.025em' }}
        >
          Bienvenido de vuelta
        </h1>
        <p className="text-sm text-navy-light/50 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
          Ingresá tu correo y contraseña para<br />
          acceder al sistema administrativo.
        </p>
      </div>

      {/* Auth error banner */}
      {authError && (
        <div
          className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-6 text-[13px] text-coral-deep"
          style={{ background: 'rgba(239,85,84,0.07)', border: '1px solid rgba(239,85,84,0.2)', fontFamily: 'var(--font-body)' }}
        >
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {authError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        {/* Correo */}
        <div>
          <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>
            Correo electrónico o cédula
          </label>
          <input
            type="text"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            placeholder="ejemplo@correo.com o 1-0384-0921"
            className={`${INPUT} ${emailErr ? INPUT_ERROR : INPUT_NORMAL}`}
            style={{ fontFamily: 'var(--font-body)' }}
          />
          {emailErr && (
            <p className="flex items-center gap-1.5 mt-1.5 text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>
              <AlertCircle size={12} className="shrink-0" />
              {emailErr}
            </p>
          )}
        </div>

        {/* Contraseña */}
        <div>
          <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); if (passErr) setPassErr('') }}
              placeholder="••••••••"
              className={`${INPUT} pr-11 ${passErr ? INPUT_ERROR : INPUT_NORMAL}`}
              style={{ fontFamily: 'var(--font-body)' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/30 hover:text-navy-light/60 transition-colors"
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passErr && (
            <p className="flex items-center gap-1.5 mt-1.5 text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>
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
          <span className="text-[13px] text-navy-light/60 select-none" style={{ fontFamily: 'var(--font-body)' }}>
            Recordarme
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all"
          style={{
            background: loading ? '#c0453a' : '#EF5554',
            fontFamily: 'var(--font-body)',
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
      <p className="mt-5 text-center text-[13px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
        ¿Olvidaste tu contraseña?{' '}
        <Link href="/recuperar" className="text-navy-light hover:text-navy font-medium transition-colors">
          Recuperar acceso →
        </Link>
      </p>

      {/* Separador */}
      <div className="relative flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[rgba(22,20,64,0.10)]" />
        <span className="text-[11px] text-navy-light/30 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
          o
        </span>
        <div className="flex-1 h-px bg-[rgba(22,20,64,0.10)]" />
      </div>

      {/* Smart Link */}
      {!showMagic ? (
        <button
          type="button"
          onClick={() => setShowMagic(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border py-3.5 text-[13px] font-medium text-navy-light/60 hover:text-navy hover:bg-white transition-all"
          style={{ borderColor: 'rgba(22,20,64,0.15)', fontFamily: 'var(--font-body)' }}
        >
          <Zap size={14} className="text-teal-deep" />
          Ingresar con Smart Link
        </button>
      ) : (
        <form
          onSubmit={handleMagicSubmit}
          className="space-y-3"
          style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
        >
          <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <input
            type="text"
            autoFocus
            value={magicToken}
            onChange={e => setMagicToken(e.target.value)}
            placeholder="Pegá tu Smart Link token aquí..."
            className={`${INPUT} ${INPUT_NORMAL}`}
            style={{ fontFamily: 'var(--font-body)' }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowMagic(false); setMagicToken('') }}
              className="flex-1 rounded-xl border py-3 text-[13px] text-navy-light/50 hover:bg-white transition-colors"
              style={{ borderColor: 'rgba(22,20,64,0.12)', fontFamily: 'var(--font-body)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={magicLoading || !magicToken.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: '#519DA2', fontFamily: 'var(--font-body)', cursor: magicLoading ? 'not-allowed' : 'pointer' }}
            >
              {magicLoading ? <><Loader2 size={14} className="animate-spin" /> Verificando...</> : 'Enviar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

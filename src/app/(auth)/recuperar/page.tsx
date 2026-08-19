'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2, CheckCircle, ChevronLeft, Mail } from 'lucide-react'

const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all',
  'placeholder:text-navy-light/50',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
].join(' ')

function RecuperarContent() {
  // AUTH-1: ?nueva=1 → misma mecánica de recuperación con copy de "crear tu
  // contraseña" (las cuentas se crearon en lote con contraseña aleatoria; la
  // persona la define acá la primera vez, con un link a demanda que no expira
  // guardado en ningún correo viejo).
  const isFirstTime = useSearchParams().get('nueva') === '1'
  const [email, setEmail]       = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState('')

  function validate() {
    if (!email.trim()) { setEmailErr('Ingresá tu correo electrónico'); return false }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailErr('El formato del correo no es válido'); return false }
    setEmailErr('')
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setError('')
    try {
      // Nuestro endpoint genera el enlace y lo manda por SES. Antes esto usaba
      // supabase.auth.resetPasswordForEmail, cuyo enlace SOLO funcionaba en el
      // mismo navegador donde se pedía (flujo PKCE): quien lo abría en el celular
      // veía "enlace inválido".
      const res = await fetch('/api/auth/password-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.trim() }),
      })
      if (res.status === 429) {
        const d = await res.json().catch(() => null)
        setError(d?.error ?? 'Demasiados intentos. Esperá unos minutos.')
        return
      }
      // La respuesta es neutral a propósito: no revela si el correo existe.
      setSent(true)
    } catch {
      setError('No pudimos enviar el correo. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div
        className="w-full text-center max-w-[400px]"
        style={{ animation: 'fadeIn 0.35s ease-out' }}
      >
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        <div className="flex justify-center mb-5">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center bg-[rgba(112,189,194,0.15)]"
          >
            <CheckCircle size={28} className="text-teal-deep" />
          </div>
        </div>

        <h2
          className="text-2xl text-navy mb-3 font-display font-extrabold tracking-[-0.025em]"
        >
          Correo enviado
        </h2>

        <p className="text-sm text-navy-light/80 leading-relaxed mb-2 font-body">
          {isFirstTime
            ? 'Si el correo ingresado está registrado en el sistema, en los próximos minutos vas a recibir el enlace para crear tu contraseña. Abrilo y usalo de una vez.'
            : 'Si el correo ingresado está registrado en el sistema, recibirás las instrucciones en los próximos minutos.'}
        </p>

        <p className="text-[13px] text-navy-light/80 mb-8 font-body">
          Revisá también tu carpeta de spam.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all bg-coral font-body shadow-[0_8px_24px_rgba(239,85,84,0.28)]"
        >
          Volver al login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px]">

      {/* Back link */}
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-navy-light transition-colors mb-7 font-body"
      >
        <ChevronLeft size={15} />
        Volver al login
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center mb-5 bg-[rgba(112,189,194,0.12)]"
        >
          <Mail size={20} className="text-teal-deep" />
        </div>
        <h1
          className="text-3xl text-navy mb-2 font-display font-extrabold tracking-[-0.025em]"
        >
          {isFirstTime ? 'Creá tu contraseña' : 'Recuperá tu acceso'}
        </h1>
        <p className="text-sm text-navy-light/80 leading-relaxed font-body">
          {isFirstTime
            ? 'Ingresá el correo con el que estás registrado en Theos Place y te enviaremos el enlace para definir tu contraseña.'
            : <>Ingresá tu correo y te enviaremos<br />instrucciones para restablecer tu contraseña.</>}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="recuperar-email"
            className="block text-[13px] font-medium text-navy-light/80 mb-1.5 font-body"
          >
            Correo electrónico
          </label>
          <input
            id="recuperar-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            placeholder="vos@theosplace.org"
            className={`${INPUT} font-body ${emailErr ? 'border-coral/50 focus:border-coral/60 focus:ring-coral/10' : 'border-[rgba(22,20,64,0.15)]'}`}
          />
          {emailErr && (
            <p className="flex items-center gap-1.5 mt-1.5 text-[13px] text-coral font-body">
              <AlertCircle size={12} className="shrink-0" />
              {emailErr}
            </p>
          )}
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-[13px] text-coral font-body">
            <AlertCircle size={12} className="shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all font-body bg-coral hover:bg-coral-deep disabled:opacity-50"
          style={{
            boxShadow: loading ? 'none' : '0 8px 24px rgba(239,85,84,0.28)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Enviando...</>
          ) : isFirstTime ? 'Enviarme el enlace' : 'Enviar instrucciones'}
        </button>
      </form>
    </div>
  )
}

export default function RecuperarPage() {
  // useSearchParams exige Suspense en App Router.
  return (
    <Suspense fallback={null}>
      <RecuperarContent />
    </Suspense>
  )
}

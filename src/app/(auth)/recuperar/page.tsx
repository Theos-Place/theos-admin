'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { fieldA11y } from '@/lib/forms/field-a11y'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2, CheckCircle, ChevronLeft, Mail, ShieldAlert } from 'lucide-react'

const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all',
  'placeholder:text-navy-light/80',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
].join(' ')

function RecuperarContent() {
  // AUTH-1: ?nueva=1 → misma mecánica de recuperación con copy de "crear tu
  // contraseña" (las cuentas se crearon en lote con contraseña aleatoria; la
  // persona la define acá la primera vez, con un link a demanda que no expira
  // guardado en ningún correo viejo).
  const params = useSearchParams()
  const isFirstTime = params.get('nueva') === '1'
  // AUT-3 · A dónde iba antes de caer acá. Se manda al servidor para que viaje
  // dentro del enlace del correo: si no, al definir la contraseña aterrizaba en
  // el dashboard en vez de en la matrícula que estaba tratando de hacer.
  const destino = params.get('redirect')
  const [email, setEmail]       = useState('')
  const [emailErr, setEmailErr] = useState('')
  // AUD-1 · id explícito para no romper el autocompletado del navegador.
  const a11yEmail = fieldA11y('correo', emailErr, { required: true, id: 'recuperar-email' })
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [aviso, setAviso] = useState('')
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
        body: JSON.stringify({ identifier: email.trim(), destino: destino ?? undefined }),
      })
      if (res.status === 429) {
        const d = await res.json().catch(() => null)
        setError(d?.error ?? 'Demasiados intentos. Esperá unos minutos.')
        return
      }
      // La respuesta es neutral a propósito: no revela si el correo existe.
      // La excepción es el menor de edad: ahí SÍ se le dice por qué, porque si
      // no se queda pidiendo un enlace que nunca le va a servir.
      const cuerpo = await res.json().catch(() => null) as { message?: string; code?: string } | null
      if (cuerpo?.code === 'menor_de_edad' && cuerpo.message) setAviso(cuerpo.message)
      setSent(true)
    } catch {
      setError('No pudimos enviar el correo. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // El menor de edad NO ve "correo enviado": no se le mandó ninguno y decirle
  // que sí lo deja esperando. Ve por qué no puede tener cuenta.
  if (aviso) {
    return (
      <div className="w-full text-center max-w-[400px]">
        <div className="flex justify-center mb-5">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-coral/10">
            <ShieldAlert size={28} className="text-coral-deep" aria-hidden />
          </div>
        </div>
        <h2 className="text-2xl text-navy mb-3 font-display font-extrabold tracking-[-0.025em]">
          Todavía no podés tener cuenta
        </h2>
        <p className="text-sm text-navy-light/80 leading-relaxed mb-4 font-body">{aviso}</p>
        <Link href="/login" className="text-sm text-coral hover:underline font-body">
          Volver al inicio
        </Link>
      </div>
    )
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
          Si el correo ingresado está registrado en el sistema, en los próximos
          minutos te llega el enlace para definir tu contraseña. Abrilo y usalo
          de una vez: sirve una sola vez y vence.
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
          {isFirstTime ? 'Creá tu contraseña' : 'Conseguí tu contraseña'}
        </h1>
        <p className="text-sm text-navy-light/80 leading-relaxed font-body">
          {/* AUT-3 · Esta pantalla atiende los DOS casos con el mismo mecanismo
              —nunca tuve contraseña / se me olvidó— y no sabe cuál es: eso lo
              resuelve el servidor, que manda "Definí" o "Restablecé" según
              corresponda. Por eso el texto de acá no puede decir "restablecer":
              quien nunca tuvo una se queda pensando que está en el lugar
              equivocado. Dice lo que sí es cierto en los dos casos. */}
          {isFirstTime
            ? 'Ingresá el correo con el que estás registrado en Theos Place y te enviaremos el enlace para definir tu contraseña.'
            : <>Ingresá tu correo y te mandamos un enlace para definir tu contraseña.<br />
               Sirve igual si es tu primera vez o si se te olvidó.</>}
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
            {...a11yEmail.input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            placeholder="vos@theosplace.org"
            className={`${INPUT} font-body ${emailErr ? 'border-coral/50 focus:border-coral/60 focus:ring-coral/10' : 'border-[rgba(22,20,64,0.15)]'}`}
          />
          {emailErr && (
            <p {...a11yEmail.error} className="flex items-center gap-1.5 mt-1.5 text-[13px] text-coral font-body">
              <AlertCircle size={12} className="shrink-0" />
              {emailErr}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-[13px] text-coral font-body">
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
          ) : 'Enviarme el enlace'}
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

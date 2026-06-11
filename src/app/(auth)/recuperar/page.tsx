'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2, CheckCircle, ChevronLeft, Mail } from 'lucide-react'
import { MOCK_RECOVERY_DELAY_MS } from '@/lib/constants'

const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all',
  'placeholder:text-navy-light/50',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
].join(' ')

export default function RecuperarPage() {
  const [email, setEmail]       = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)

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
    await new Promise(r => setTimeout(r, MOCK_RECOVERY_DELAY_MS))
    setLoading(false)
    setSent(true)
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

        <p className="text-sm text-navy-light/55 leading-relaxed mb-2 font-body">
          Si el correo ingresado está registrado en el sistema, recibirás las instrucciones en los próximos minutos.
        </p>

        <p className="text-[12px] text-navy-light/40 mb-8 font-body">
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
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/40 hover:text-navy-light transition-colors mb-7 font-body"
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
          Recuperá tu acceso
        </h1>
        <p className="text-sm text-navy-light/50 leading-relaxed font-body">
          Ingresá tu correo y te enviaremos<br />
          instrucciones para restablecer tu contraseña.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="recuperar-email"
            className="block text-[12px] font-medium text-navy-light/60 mb-1.5 font-body"
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
            <p className="flex items-center gap-1.5 mt-1.5 text-[12px] text-coral font-body">
              <AlertCircle size={12} className="shrink-0" />
              {emailErr}
            </p>
          )}
        </div>

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
          ) : 'Enviar instrucciones'}
        </button>
      </form>
    </div>
  )
}

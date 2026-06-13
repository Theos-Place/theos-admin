'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, Loader2, CheckCircle, Check, Lock } from 'lucide-react'
import { MOCK_PASSWORD_RESET_DELAY_MS } from '@/lib/constants'

const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all',
  'placeholder:text-navy-light/50',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
].join(' ')

interface Req {
  label: string
  test: (v: string) => boolean
}

const REQUIREMENTS: Req[] = [
  { label: 'Mínimo 8 caracteres',    test: v => v.length >= 8 },
  { label: 'Al menos una mayúscula', test: v => /[A-Z]/.test(v) },
  { label: 'Al menos un número',     test: v => /[0-9]/.test(v) },
]

export default function NuevaContrasenaPage() {
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmErr, setConfirmErr] = useState('')
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)

  const reqs = REQUIREMENTS.map(r => ({ ...r, met: r.test(password) }))
  const allReqsMet = reqs.every(r => r.met)

  function handleConfirmBlur() {
    if (confirm && password !== confirm) {
      setConfirmErr('Las contraseñas no coinciden')
    } else {
      setConfirmErr('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allReqsMet || !confirm) return
    if (password !== confirm) { setConfirmErr('Las contraseñas no coinciden'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, MOCK_PASSWORD_RESET_DELAY_MS))
    setLoading(false)
    setDone(true)
  }

  if (done) {
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
          Contraseña actualizada
        </h2>
        <p className="text-sm text-navy-light/55 leading-relaxed mb-8 font-body">
          Tu contraseña fue cambiada exitosamente.
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

  return (
    <div className="w-full max-w-[400px]">

      {/* Header */}
      <div className="mb-8">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center mb-5 bg-[rgba(22,20,64,0.06)]"
        >
          <Lock size={20} className="text-navy-light/60" />
        </div>
        <h1
          className="text-3xl text-navy mb-2 font-display font-extrabold tracking-[-0.025em]"
        >
          Creá tu nueva contraseña
        </h1>
        <p className="text-[13px] text-navy-light/60 font-body">
          El link es válido por 24 horas.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        {/* Nueva contraseña */}
        <div>
          <label
            className="block text-[12px] font-medium text-navy-light/60 mb-1.5 font-body"
          >
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${INPUT} pr-11 border-[rgba(22,20,64,0.15)] font-body`}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/60 hover:text-navy-light/80 transition-colors"
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Requisitos */}
        <div className="space-y-1.5 px-1">
          {reqs.map(req => (
            <div
              key={req.label}
              className="flex items-center gap-2 text-[12px] transition-all duration-200 font-body"
              style={{
                color: password.length === 0 ? 'rgba(41,54,92,0.35)' : req.met ? '#519DA2' : 'rgba(239,85,84,0.7)',
              }}
            >
              {req.met && password.length > 0
                ? <Check size={12} className="shrink-0" />
                : <span className="h-3 w-3 rounded-full border shrink-0 border-current inline-block" />
              }
              {req.label}
            </div>
          ))}
        </div>

        {/* Confirmar contraseña */}
        <div>
          <label
            className="block text-[12px] font-medium text-navy-light/60 mb-1.5 font-body"
          >
            Confirmar contraseña
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); if (confirmErr) setConfirmErr('') }}
              onBlur={handleConfirmBlur}
              placeholder="••••••••"
              className={`${INPUT} pr-11 font-body ${confirmErr ? 'border-coral/50 focus:border-coral/60 focus:ring-coral/10' : 'border-[rgba(22,20,64,0.15)]'}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-light/60 hover:text-navy-light/80 transition-colors"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirmErr && (
            <p className="flex items-center gap-1.5 mt-1.5 text-[12px] text-coral font-body">
              <AlertCircle size={12} className="shrink-0" />
              {confirmErr}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !allReqsMet || !confirm}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-coral hover:bg-coral-deep font-body"
          style={{
            boxShadow: (!loading && allReqsMet && confirm) ? '0 8px 24px rgba(239,85,84,0.28)' : 'none',
          }}
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
            : 'Guardar nueva contraseña'
          }
        </button>
      </form>
    </div>
  )
}

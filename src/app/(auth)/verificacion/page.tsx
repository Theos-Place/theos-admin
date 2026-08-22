'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const LABEL = 'block text-[13px] font-medium text-navy-light/80 mb-1.5 font-body'
const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all placeholder:text-navy-light/80',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
  'border-[rgba(22,20,64,0.15)]',
].join(' ')

/**
 * Pantalla de step-up del segundo factor (TOTP). El proxy manda acá a los
 * usuarios con sesión aal1 que tienen TOTP activo. Si llegan sin necesitar
 * MFA (ya aal2 o sin factor), los devolvemos al dashboard.
 */
export default function VerificacionPage() {
  const router = useRouter()
  const [resolving, setResolving]   = useState(true)
  const [factorId, setFactorId]     = useState<string | null>(null)
  const [code, setCode]             = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (!(aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2')) {
          router.replace('/dashboard')
          return
        }
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.[0] ?? factors?.all?.find(f => f.factor_type === 'totp' && f.status === 'verified')
        if (!totp) {
          router.replace('/dashboard')
          return
        }
        if (!cancelled) setFactorId(totp.id)
      } catch {
        if (!cancelled) setError('No se pudo cargar la verificación. Intentá de nuevo.')
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error || !challenge.data) {
        setError('Código incorrecto. Intentá de nuevo.')
        return
      }
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      })
      if (error) {
        setError('Código incorrecto. Intentá de nuevo.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Código incorrecto. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBack() {
    try { await createClient().auth.signOut() } catch { /* sin sesión que cerrar */ }
    router.push('/login')
    router.refresh()
  }

  if (resolving) {
    return (
      <div className="w-full max-w-[400px] flex items-center gap-2 text-sm text-navy-light/80 font-body">
        <Loader2 size={16} className="animate-spin" /> Cargando...
      </div>
    )
  }

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

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-6 text-[13px] text-coral-deep bg-[rgba(239,85,84,0.07)] border border-[rgba(239,85,84,0.2)] font-body">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="mfa-code" className={LABEL}>Código de 6 dígitos</label>
          <input
            id="mfa-code"
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (error) setError('') }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            autoFocus
            className={`${INPUT} font-mono text-center tracking-[0.4em]`}
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all font-body disabled:opacity-50 bg-coral hover:bg-coral-deep"
          style={{
            boxShadow: loading ? 'none' : '0 8px 24px rgba(239,85,84,0.30)',
            cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Verificando...</> : 'Verificar'}
        </button>
      </form>

      <button
        type="button"
        onClick={handleBack}
        className="mt-5 mx-auto flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-navy transition-colors font-body"
      >
        <ArrowLeft size={14} /> Volver al inicio de sesión
      </button>
    </div>
  )
}

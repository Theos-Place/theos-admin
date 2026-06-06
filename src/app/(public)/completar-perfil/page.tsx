'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Lock } from 'lucide-react'

export default function CompletarPerfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // El link de invitación trae los tokens en la URL; el client los procesa.
  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setHasSession(!!data.session); setReady(true) }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) { setHasSession(!!session); setReady(true) }
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [supabase])

  async function submit() {
    setError(null)
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err) {
      console.error('No se pudo guardar la contraseña:', err)
      setError('No se pudo guardar la contraseña. Pedí un nuevo link e intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--surface-low)' }}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 space-y-5" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-navy" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            Completá tu perfil
          </h1>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            Creá una contraseña para acceder a tu cuenta de Theos Place.
          </p>
        </div>

        {!ready ? (
          <p className="text-sm text-navy-light/50 py-6 text-center" style={{ fontFamily: 'var(--font-body)' }}>Cargando…</p>
        ) : done ? (
          <div className="py-6 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
              <Check size={26} className="text-teal-deep" />
            </div>
            <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>¡Listo! Tu contraseña quedó guardada.</p>
          </div>
        ) : !hasSession ? (
          <p className="text-sm text-coral py-4" style={{ fontFamily: 'var(--font-body)' }}>
            Este link no es válido o ya expiró. Pedí una nueva invitación.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Contraseña</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-2xl border pl-9 pr-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-coral/30"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Repetir contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-coral/30"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                placeholder="Repetí la contraseña"
              />
            </div>

            {error && <p className="text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>{error}</p>}

            <button
              onClick={submit}
              disabled={saving}
              className="w-full rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Check, Lock, Mail, AlertTriangle } from 'lucide-react'
import { readAuthLinkError, authLinkMessage, type AuthLinkMessage } from '@/lib/auth/link-error'

// Primer ingreso: el usuario llega desde el correo de invitación de Supabase Auth
// con los tokens en el FRAGMENTO (#access_token=…&type=invite). El fragmento no se
// manda al servidor, así que la sesión se procesa SOLO del lado del cliente
// (getSession + onAuthStateChange). Acá fija su contraseña por primera vez.
// La misma página sirve para recovery (reset) si el link llega con type=recovery.
export default function CompletarPerfilPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [isRecovery, setIsRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // El tipo de link (invite vs recovery) viaja en el fragmento → cambia el mensaje.
  // Y si el link falló, Supabase manda el motivo ahí mismo: con eso se distingue
  // "ya se usó" de "está roto" en vez de mandar a todo el mundo a pedir otro.
  const [linkMsg, setLinkMsg] = useState<AuthLinkMessage | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (params.get('type') === 'recovery') setIsRecovery(true)
    const err = readAuthLinkError(window.location)
    setLinkMsg(authLinkMessage(err, params.get('type') === 'recovery' ? 'recuperacion' : 'invitacion'))
  }, [])

  // Quién es la persona se resuelve con getUser(), que PREGUNTA AL SERVIDOR con
  // la cookie actual — no con getSession(), que puede devolver la sesión cacheada
  // en memoria.
  //
  // BUG que arregla (2026-08-03): si alguien abría la invitación en un navegador
  // donde YA había otra cuenta abierta, la pantalla mostraba el correo VIEJO. Y lo
  // peligroso no era el rótulo: la contraseña se le podía terminar poniendo a la
  // cuenta equivocada.
  useEffect(() => {
    let alive = true
    const supabase = createClient()
    async function resolver() {
      const { data, error } = await supabase.auth.getUser()
      if (!alive) return
      setHasSession(!!data.user && !error)
      setEmail(data.user?.email ?? null)
      setReady(true)
    }
    void resolver()
    // Si el token del fragmento se procesa después, se vuelve a preguntar.
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void resolver() })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        // Mensaje real de Supabase (contraseña débil/filtrada, link expirado, etc.).
        setError(error.message || 'No se pudo guardar la contraseña.')
        setSaving(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1600)
    } catch {
      setError('No se pudo guardar la contraseña. El enlace pudo expirar; pedí uno nuevo.')
      setSaving(false)
    }
  }

  const title = isRecovery ? 'Restablecé tu contraseña' : '¡Bienvenido a Theos Place!'
  const subtitle = isRecovery
    ? 'Elegí una nueva contraseña para tu cuenta.'
    : 'Creá tu contraseña para activar tu cuenta.'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-low">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-lg)]">
        {/* Header de marca */}
        <div className="bg-navy px-7 pt-8 pb-7 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-theos-white.png" alt="Theos Place" className="mx-auto h-9 w-auto" />
        </div>

        <div className="p-7 space-y-5">
          {!ready ? (
            <p className="text-sm text-navy-light/80 py-6 text-center font-body">Verificando tu enlace…</p>
          ) : done ? (
            <div className="py-6 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
                <Check size={26} className="text-teal-deep" />
              </div>
              <p className="text-base font-bold text-navy font-display">¡Cuenta activada!</p>
              <p className="text-sm text-navy-light/80 font-body">Tu contraseña quedó guardada. Te estamos llevando al inicio…</p>
            </div>
          ) : !hasSession ? (
            <div className="py-2 space-y-4 text-center">
              <div className="h-14 w-14 rounded-full bg-coral/10 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} className="text-coral" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-navy font-display">
                  {linkMsg?.titulo ?? 'Este enlace ya se usó o venció'}
                </p>
                <p className="text-sm text-navy-light/80 font-body leading-relaxed">
                  {linkMsg?.detalle ?? 'Los enlaces sirven una sola vez. Si ya definiste tu contraseña, entrá con ella.'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {(linkMsg?.acciones ?? ['login', 'pedir_enlace']).map(accion => accion === 'login' ? (
                  <Link
                    key="login"
                    href="/login"
                    className="rounded-2xl bg-coral px-4 py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors font-body"
                  >
                    Iniciar sesión
                  </Link>
                ) : (
                  <Link
                    key="pedir"
                    href="/recuperar?nueva=1"
                    className="rounded-2xl border border-[var(--outline-variant)] px-4 py-3 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
                  >
                    Pedir un enlace nuevo
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-xl font-extrabold text-navy font-display tracking-[-0.02em]">{title}</h1>
                <p className="text-sm text-navy-light/80 font-body">{subtitle}</p>
              </div>

              {email && (
                <div className="flex items-center gap-2 rounded-2xl bg-surface-low px-3 py-2.5">
                  <Mail size={15} className="shrink-0 text-navy-light/80" />
                  <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">{email}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">Contraseña nueva</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/80" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full rounded-2xl border pl-9 pr-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-coral/30 border-[var(--outline-variant)] font-body"
                    placeholder="Mínimo 8 caracteres"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">Repetir contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-coral/30 border-[var(--outline-variant)] font-body"
                  placeholder="Repetí la contraseña"
                />
              </div>

              {error && <p className="text-[13px] text-coral font-body">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
              >
                {saving ? 'Guardando…' : isRecovery ? 'Guardar contraseña' : 'Activar mi cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

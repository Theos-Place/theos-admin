'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Send, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { loginUrlWithDest } from '@/lib/auth/redirect-target'

/** Botón "Aplicar" de la vista PÚBLICA de vacantes (/vacantes). Ver la vacante
 *  no requiere sesión; aplicar sí. Sin sesión → manda a /login con redirect de
 *  vuelta a /vacantes. Con sesión → aplica vía /api/servers/vacancies/[id]/apply. */
export function PublicApplyButton({ vacancyId, className }: { vacancyId: string; className?: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'already' | 'error' | 'auth'>('idle')

  async function apply() {
    if (state === 'sending' || state === 'done') return
    setState('sending')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Login-gate: volvés a /vacantes tras autenticarte.
        setState('auth')
        router.push(loginUrlWithDest('/vacantes'))
        return
      }
      const res = await fetch(`/api/servers/vacancies/${vacancyId}/apply`, { method: 'POST' })
      if (res.status === 201) { setState('done'); return }
      const d = await res.json().catch(() => null) as { code?: string } | null
      if (res.status === 409 && d?.code === 'already_applied') { setState('already'); return }
      if (res.status === 401) { setState('auth'); router.push(loginUrlWithDest('/vacantes')); return }
      setState('error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done' || state === 'already') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-teal-soft/30 px-4 py-2 text-sm text-teal-deep font-body', className)}>
        <Check size={15} />
        {state === 'done' ? 'Aplicación enviada' : 'Ya aplicaste'}
      </span>
    )
  }

  return (
    <button
      onClick={apply}
      disabled={state === 'sending' || state === 'auth'}
      className={cn('inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-deep transition-colors disabled:opacity-60 font-body', className)}
    >
      {state === 'auth' ? <LogIn size={14} /> : <Send size={14} />}
      {state === 'sending' ? 'Enviando…' : state === 'auth' ? 'Redirigiendo…' : state === 'error' ? 'Reintentar' : 'Aplicar a este puesto'}
    </button>
  )
}

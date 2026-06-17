'use client'

import { useState } from 'react'
import { Check, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Botón "Aplicar a este puesto" — disponible para cualquier miembro. Aplica al
 *  usuario autenticado vía /api/servers/vacancies/[id]/apply. */
export function ApplyToVacancyButton({ vacancyId, className }: { vacancyId: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'already' | 'error'>('idle')

  async function apply() {
    if (state === 'sending' || state === 'done') return
    setState('sending')
    try {
      const res = await fetch(`/api/servers/vacancies/${vacancyId}/apply`, { method: 'POST' })
      if (res.status === 201) { setState('done'); return }
      const d = await res.json().catch(() => null) as { error?: string } | null
      if (res.status === 409 && d?.error === 'already_applied') { setState('already'); return }
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
      disabled={state === 'sending'}
      className={cn('inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-deep transition-colors disabled:opacity-60 font-body', className)}
    >
      <Send size={14} />
      {state === 'sending' ? 'Enviando…' : state === 'error' ? 'Reintentar' : 'Aplicar a este puesto'}
    </button>
  )
}

'use client'

import { useState } from 'react'
import { Fingerprint, Loader2, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  setPasskeySuggestion,
  clearPasskeySuggestion,
  isPasskeyCancel,
} from '@/lib/auth/passkey-suggestion'

type Phase = 'prompt' | 'registering' | 'success' | 'error'

/**
 * Modal de sugerencia de passkey tras el primer login. Nunca bloquea: pase lo
 * que pase, siempre hay un camino claro al dashboard (onDone).
 */
export function PasskeySuggestionModal({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('prompt')

  async function handleActivate() {
    setPhase('registering')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.registerPasskey()
      if (error) {
        if (isPasskeyCancel(error)) { setPhase('prompt'); return } // canceló: sin error
        setPhase('error')
        return
      }
      setPasskeySuggestion('registered')
      setPhase('success')
    } catch (err) {
      if (isPasskeyCancel(err)) { setPhase('prompt'); return }
      setPhase('error')
    }
  }

  function handleDismiss() {
    // "Ahora no": limpiamos para volver a preguntar en el próximo login.
    clearPasskeySuggestion()
    onDone()
  }

  function handleNever() {
    setPasskeySuggestion('never')
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 text-center bg-surface-card shadow-[var(--shadow-lg)]">

        <div className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-4 bg-coral/10">
          {phase === 'success'
            ? <Check size={28} className="text-coral" />
            : <Fingerprint size={28} className="text-coral" />}
        </div>

        {phase === 'success' ? (
          <>
            <h2 className="text-lg font-bold text-navy font-display">Huella activada</h2>
            <p className="mt-2 text-[13px] text-navy-light/60 leading-relaxed font-body">
              A partir de ahora podés ingresar sin contraseña.
            </p>
            <button
              onClick={onDone}
              className="mt-5 w-full rounded-xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-all font-body"
            >
              Ir al dashboard
            </button>
          </>
        ) : phase === 'error' ? (
          <>
            <div className="mx-auto -mt-1 mb-2 flex items-center justify-center text-coral">
              <AlertCircle size={18} />
            </div>
            <h2 className="text-lg font-bold text-navy font-display">No se pudo activar</h2>
            <p className="mt-2 text-[13px] text-navy-light/60 leading-relaxed font-body">
              Podés intentarlo más tarde desde Configuración → Seguridad.
            </p>
            <button
              onClick={onDone}
              className="mt-5 w-full rounded-xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-all font-body"
            >
              Ir al dashboard
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-navy font-display">Ingresá más rápido la próxima vez</h2>
            <p className="mt-2 text-[13px] text-navy-light/60 leading-relaxed font-body">
              Podés configurar tu huella o Face ID para entrar al sistema sin escribir tu contraseña. Solo tarda unos segundos.
            </p>

            <button
              onClick={handleActivate}
              disabled={phase === 'registering'}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-all disabled:opacity-60 disabled:cursor-not-allowed font-body"
            >
              {phase === 'registering'
                ? <><Loader2 size={15} className="animate-spin" /> Esperando confirmación...</>
                : 'Activar ahora'}
            </button>

            <button
              onClick={handleDismiss}
              disabled={phase === 'registering'}
              className="mt-2 w-full rounded-xl border py-3 text-sm text-navy-light hover:bg-surface-low transition-all disabled:opacity-50 border-[var(--outline-variant)] font-body"
            >
              Ahora no
            </button>

            <button
              onClick={handleNever}
              disabled={phase === 'registering'}
              className="mt-3 text-[12px] text-navy-light/40 hover:text-navy-light/70 transition-colors disabled:opacity-50 font-body"
            >
              No volver a mostrar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

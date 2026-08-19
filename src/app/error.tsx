'use client' // Los error boundaries deben ser Client Components

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error) // no-op sin NEXT_PUBLIC_SENTRY_DSN
    console.error('[app/error]', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-[rgba(239,85,84,0.15)] bg-surface-card p-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(239,85,84,0.08)]">
          <AlertTriangle size={22} className="text-coral" />
        </div>
        <p className="mb-1 font-display text-base font-semibold text-navy">
          Algo salió mal
        </p>
        <p className="mb-5 max-w-xs font-body text-sm text-navy-light/80">
          Ocurrió un error inesperado. Podés intentar de nuevo; si persiste,
          avisale al equipo de TI.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => unstable_retry()}
            className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 font-body text-sm font-medium text-white transition-colors"
          >
            <RotateCcw size={14} />
            Intentar de nuevo
          </button>
          <a
            href="/dashboard"
            className="rounded-full px-4 py-2 font-body text-sm font-medium text-navy-light/80 transition-colors hover:text-navy"
          >
            Ir al dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

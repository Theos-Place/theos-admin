'use client'

import dynamic from 'next/dynamic'

/**
 * Versión lazy del editor de email: TipTap (+ extensiones) pesa bastante, así
 * que el chunk se carga solo cuando el editor se renderiza de verdad (ej. en
 * comunicaciones/nueva no se carga si el canal es solo WhatsApp). Mientras
 * llega, un skeleton con la altura aproximada del editor evita saltos de layout.
 */
export const EmailEditor = dynamic(
  () => import('./EmailEditor').then(m => m.EmailEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-[var(--outline-variant)] overflow-hidden" aria-hidden>
        <div className="h-10 bg-surface-low animate-pulse" />
        <div className="min-h-[220px] bg-surface-card flex items-center justify-center">
          <p className="text-sm text-navy-light/60 font-body">Cargando editor…</p>
        </div>
      </div>
    ),
  },
)

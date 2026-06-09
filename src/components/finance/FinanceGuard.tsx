'use client'
import { Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function FinanceGuard({ children }: { children: React.ReactNode }) {
  const { loaded, hasRole } = useAuth()

  if (!loaded) return null

  if (!hasRole('finanzas', 'admin', 'direccion')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[rgba(239,85,84,0.10)]">
          <Lock size={24} className="text-coral" />
        </div>
        <h2
          className="text-xl font-bold font-display text-navy"
        >
          Acceso restringido
        </h2>
        <p
          className="text-sm text-center max-w-sm font-body text-[rgba(22,20,64,0.50)]"
        >
          Este módulo es solo para el equipo de Finanzas.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

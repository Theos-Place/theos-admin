'use client'
import { Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/**
 * `reportes`: la pantalla es un REPORTE, y un puesto de dirección (Director
 * de Área o comité Directores) también entra — solo a mirar (REP-18,
 * 2026-10-20). Los endpoints lo vuelven a comprobar con requireVistaFinanciera.
 */
export function FinanceGuard({ children, reportes }: { children: React.ReactNode; reportes?: boolean }) {
  const { loaded, hasRole, user } = useAuth()

  // Mientras cargan los roles: spinner en vez de pantalla en blanco.
  if (!loaded) {
    return (
      <div className="py-16 text-center font-body">
        <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
        <p className="text-sm text-navy-light/80">Cargando…</p>
      </div>
    )
  }

  if (!hasRole('finanzas', 'admin', 'direccion') && !(reportes && user?.direccion_por_puesto === true)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[rgba(214,62,61,0.10)]">
          <Lock size={24} className="text-coral-deep" />
        </div>
        <h2
          className="text-xl font-bold font-display text-navy"
        >
          Acceso restringido
        </h2>
        <p
          className="text-sm text-center max-w-sm font-body text-navy-light/80"
        >
          Este módulo es solo para el equipo de Finanzas.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

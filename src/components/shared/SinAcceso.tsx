import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'

/**
 * "No tenés acceso a esto." Un 403 no es un error de la persona ni una falla
 * del sistema, y hasta hoy se pintaba como si fuera las dos cosas: la ficha de
 * un miembro mostraba «Error cargando miembro: No autorizado» en rojo, que
 * suena a que algo se rompió.
 *
 * Dice qué pasó, por qué, y a dónde ir. Sin detalles de permisos: a quien no
 * tiene acceso no le sirve saber qué rol le falta, y enumerarlo le cuenta al
 * curioso cómo está armado el sistema.
 */
export function SinAcceso({
  que = 'esta sección',
  volverA = '/dashboard',
  volverLabel = 'Ir al inicio',
}: {
  /** Qué intentó abrir, en palabras: "esta ficha", "los reportes". */
  que?: string
  volverA?: string
  volverLabel?: string
}) {
  return (
    <EmptyState
      icon={ShieldAlert}
      title={`No tenés acceso a ${que}`}
      description={
        'Tu rol no incluye esta parte del sistema. Si creés que deberías verla, '
        + 'escribí a soporte@theosplace.org y decinos qué estabas buscando.'
      }
      action={
        <Link
          href={volverA}
          className="inline-flex items-center rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-deep font-body"
        >
          {volverLabel}
        </Link>
      }
    />
  )
}

/** ¿El error que devolvió una carga es un 403? Los endpoints contestan
 *  `{ error: 'No autorizado' }` (convención de AGENTS.md), así que se reconoce
 *  por el texto — no hay código de estado cuando el mensaje ya viajó. */
export function esFaltaDeAcceso(error: string | null | undefined): boolean {
  return !!error && /no autorizado|no autenticado/i.test(error)
}

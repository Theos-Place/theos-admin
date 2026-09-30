'use client'

import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { puedeVerReporte, type SlugDeReporte } from '@/lib/reports/acceso-por-reporte'

/**
 * REP-11 · ¿Esta sesión puede abrir este reporte?
 *
 * El espejo en el cliente de `requireAccesoAReporte`, y existe para que las
 * dos mitades no se separen: la regla sale de `ACCESO_POR_REPORTE` en los dos
 * lados. Antes cada pantalla escribía su propio `puedeVer` con una lista de
 * roles a mano —dos lo hacían y la de Dirigentes no lo hacía— y el índice
 * tenía una tercera copia.
 *
 * Esto NO es el permiso: el permiso lo decide el endpoint. Esto decide si se
 * pinta la pantalla o el mensaje, para que nadie llegue a un reporte vacío
 * con un "Error cargando" por toda explicación.
 *
 * `loaded` va aparte a propósito: hasta que la sesión cargue, `can()` y los
 * roles devuelven vacío, y afirmar "acceso restringido" antes de eso deja un
 * parpadeo rojo en cada carga.
 */
export function useAccesoAReporte(slug: SlugDeReporte): { loaded: boolean; puedeVer: boolean } {
  const { user } = useAuth()
  const { can, loaded } = usePermissions()
  return {
    loaded,
    puedeVer: puedeVerReporte(slug, {
      roles: user?.roles ?? [],
      tieneModulo: can('reportes', 'view'),
      porPuesto: user?.abre_reportes_por_puesto === true,
    }),
  }
}

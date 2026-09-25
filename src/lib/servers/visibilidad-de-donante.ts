/**
 * SRV-10 · Quién puede ver si alguien es donante.
 *
 * ORDEN DE DIRECCIÓN, 2026-09-24: al líder de comité no se le muestra el dato
 * de donante —ni la columna, ni el KPI, ni el filtro, ni el export— mientras
 * definen cómo se usa. Los roles amplios (staff, coordinación de servidores,
 * dirección, admin: los mismos de SRV-6) lo siguen viendo.
 *
 * EL RECORTE SE HACE EN EL SERVIDOR. Esconder la columna deja el dato en el
 * JSON que cualquiera lee con la pestaña de red abierta, así que esta función
 * la usa el endpoint para no mandar el campo, y la pantalla para no dibujar lo
 * que ya no tiene. Que `Compromisos.donante` sea opcional es lo que hace que el
 * compilador señale a quien lo lea sin preguntarse si vino.
 *
 * Módulo PURO y aparte para que las dos puntas —API y UI— no puedan separarse:
 * si la regla viviera en el endpoint, la pantalla tendría que adivinarla.
 */
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'

export function puedeVerDonante(roles: readonly string[] | null | undefined): boolean {
  if (!roles) return false
  return roles.some(r => (SERVICE_ADMIN_ROLES as readonly string[]).includes(r))
}

/**
 * Quita el campo de las filas cuando no corresponde verlo.
 *
 * Borra la PROPIEDAD en vez de ponerla en `false`: un `false` diría «no es
 * donante», que es justo la información que no debe salir, y además haría que
 * «Le falta» la contara.
 */
export function recortarDonante<T extends { donante?: boolean }>(
  filas: readonly T[],
  visible: boolean,
): T[] {
  if (visible) return [...filas]
  return filas.map(f => {
    const copia = { ...f }
    delete copia.donante
    return copia
  })
}

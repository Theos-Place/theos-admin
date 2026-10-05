'use client'

/**
 * SRV-20 · ¿Esta persona puede pedir cupos de puestos de servicio?
 *
 * EL PROBLEMA QUE RESUELVE (reportado por Floriana el 2026-10-05): el botón
 * «Solicitar puestos de servicio» del índice de Servidores NO tenía ningún
 * gate — lo veía cualquiera con acceso al módulo. Al tocarlo, la pantalla de
 * pedir cupos no le ofrecía ningún comité, o el servidor respondía 403 al
 * enviar. Un botón que lleva a una puerta cerrada es peor que no tener botón:
 * la persona cree que algo se rompió.
 *
 * LA RESPUESTA SALE DEL SERVIDOR, no de una lista de roles en el cliente.
 * `/api/servers/manageable-committees` ya devuelve `{ all, ids }` — los
 * comités para los que puede pedir— y es LA MISMA fuente que usa la pantalla
 * de pedir cupos para llenar su selector. Preguntar por rol sería una tercera
 * copia de la regla: la pantalla de puestos tenía la suya
 * (`lider_comite | coordinador_servidores | admin`) y ya no coincidía con el
 * servidor, que además deja pedir a `solicitudes_puestos` (SRV-11) y a quien
 * coordina un comité por PUESTO y no por rol.
 *
 * Mientras carga devuelve `false`: es preferible que el botón aparezca un
 * instante después a que parpadee y desaparezca en la cara de quien no
 * puede.
 */

import { useState, useEffect } from 'react'

export type ComitesQuePuedePedir = {
  /** Puede pedir para CUALQUIER comité (roles administrativos globales). */
  all: boolean
  /** Si no, los comités concretos que coordina o cuya área lidera. */
  ids: string[]
}

export function usePuedePedirPuestos(): {
  puede: boolean
  cargando: boolean
  comites: ComitesQuePuedePedir | null
} {
  const [comites, setComites] = useState<ComitesQuePuedePedir | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    fetch('/api/servers/manageable-committees')
      .then(r => (r.ok ? r.json() : null))
      .then((d: ComitesQuePuedePedir | null) => {
        if (!vivo) return
        setComites(d && typeof d.all === 'boolean' ? { all: d.all, ids: d.ids ?? [] } : null)
      })
      // Si la consulta falla NO se muestra el botón: equivocarse hacia el
      // lado de esconderlo molesta a quien sí puede, pero mostrarlo manda a
      // quien no puede contra un 403 sin explicación.
      .catch(() => { if (vivo) setComites(null) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [])

  return {
    puede: !!comites && (comites.all || comites.ids.length > 0),
    cargando,
    comites,
  }
}

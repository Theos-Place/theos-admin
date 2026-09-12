/**
 * Filtro de estado de la pestaña "Solicitudes" en /finanzas/becas.
 *
 * La de cupones ya tenía filtro y esta no: la lista llegaba entera y las
 * abiertas —las únicas sobre las que hay algo que hacer— quedaban mezcladas
 * entre las ya resueltas. Con las seis del 11-set resueltas de golpe, la
 * pantalla pasó a mostrar sobre todo ruido.
 *
 * Módulo puro: la misma función cuenta las pastillas y filtra la tabla, para
 * que el número de la pastilla no pueda decir una cosa y la tabla otra.
 */
export type EstadoSolicitud = 'open' | 'in_review' | 'resolved' | 'rejected'
export type FiltroSolicitud = 'pendientes' | EstadoSolicitud | 'all'

export type SolicitudFiltrable = { status: string }

/**
 * "Pendientes" agrupa abierta + en revisión: son las dos que esperan a alguien,
 * y separarlas obliga a mirar dos pastillas para saber cuánto trabajo hay.
 */
export function coincide(estado: string, filtro: FiltroSolicitud): boolean {
  if (filtro === 'all') return true
  if (filtro === 'pendientes') return estado === 'open' || estado === 'in_review'
  return estado === filtro
}

export function filtrarSolicitudes<T extends SolicitudFiltrable>(
  solicitudes: readonly T[],
  filtro: FiltroSolicitud,
): T[] {
  return solicitudes.filter(s => coincide(s.status, filtro))
}

/** Las opciones, en el orden en que se leen: primero lo que hay que atender. */
export const FILTROS: ReadonlyArray<{ id: FiltroSolicitud; label: string }> = [
  { id: 'pendientes', label: 'Por revisar' },
  { id: 'resolved', label: 'Aprobadas' },
  { id: 'rejected', label: 'Rechazadas' },
  { id: 'all', label: 'Todas' },
]

/** Cuántas hay en cada opción. Se cuenta sobre la lista COMPLETA: si dependiera
 *  del filtro activo, las pastillas mostrarían cero apenas se elige otra. */
export function conteos<T extends SolicitudFiltrable>(
  solicitudes: readonly T[],
): Record<FiltroSolicitud, number> {
  const c = { pendientes: 0, open: 0, in_review: 0, resolved: 0, rejected: 0, all: solicitudes.length } as Record<FiltroSolicitud, number>
  for (const s of solicitudes) {
    if (s.status === 'open' || s.status === 'in_review') c.pendientes++
    if (s.status in c) c[s.status as FiltroSolicitud]++
  }
  return c
}

/** Qué filtro abrir. Si hay algo por revisar se abre en eso —es a lo que uno
 *  entra—; si no, en todas, para no dar una pantalla vacía. */
export function filtroInicial<T extends SolicitudFiltrable>(solicitudes: readonly T[]): FiltroSolicitud {
  return conteos(solicitudes).pendientes > 0 ? 'pendientes' : 'all'
}

/** Texto del vacío, según el filtro: "no hay solicitudes" es mentira cuando lo
 *  que pasa es que no hay ninguna EN ESE estado. */
export function textoVacio(filtro: FiltroSolicitud, hayAlguna: boolean): string {
  if (!hayAlguna) return 'No hay solicitudes de beca'
  const etiqueta = FILTROS.find(f => f.id === filtro)?.label.toLowerCase() ?? filtro
  return filtro === 'pendientes' ? 'No hay solicitudes por revisar' : `No hay solicitudes ${etiqueta}`
}

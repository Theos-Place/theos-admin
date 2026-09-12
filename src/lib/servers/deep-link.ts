/**
 * La selección de /servidores/admin vive en la URL: ?area=…&comite=…&puesto=…
 *
 * Para poder mandarle a alguien el link de UN puesto concreto y que lo abra ahí,
 * y para que el botón atrás del navegador devuelva a donde uno estaba. Mismo
 * criterio que el ?semana= del reporte de asistencia.
 *
 * Módulo puro: la página solo lee y escribe, no decide.
 */
export type SeleccionAdmin = {
  area: string | null
  comite: string | null
  puesto: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const limpio = (v: string | null | undefined): string | null =>
  v && UUID.test(v.trim()) ? v.trim() : null

/**
 * Lee la selección de los parámetros.
 *
 * Se valida que sean UUID: un `?puesto=<script>` o un id inventado no tiene que
 * llegar al resto de la pantalla. Y la jerarquía se respeta — sin comité no hay
 * puesto, sin área no hay comité — para que un link a medias no deje la pantalla
 * mostrando un puesto que cuelga de la nada.
 */
export function leerSeleccion(params: {
  get(k: string): string | null
}): SeleccionAdmin {
  const area = limpio(params.get('area'))
  const comite = area ? limpio(params.get('comite')) : null
  const puesto = comite ? limpio(params.get('puesto')) : null
  return { area, comite, puesto }
}

/** Arma el query string. Los vacíos NO se escriben: una URL con `?comite=` sin
 *  valor se comparte igual y confunde. */
export function escribirSeleccion(sel: SeleccionAdmin): string {
  const p = new URLSearchParams()
  if (sel.area) p.set('area', sel.area)
  if (sel.area && sel.comite) p.set('comite', sel.comite)
  if (sel.area && sel.comite && sel.puesto) p.set('puesto', sel.puesto)
  const s = p.toString()
  return s ? `?${s}` : ''
}

/**
 * La selección después de tocar algo, respetando la jerarquía: cambiar de área
 * borra el comité y el puesto; cambiar de comité borra el puesto. Sin esto,
 * elegir otro comité dejaba el `?puesto=` del anterior en la URL apuntando a un
 * puesto que ya no está en pantalla.
 */
export function alElegir(
  actual: SeleccionAdmin,
  cambio: { area?: string | null; comite?: string | null; puesto?: string | null },
): SeleccionAdmin {
  if ('area' in cambio) return { area: cambio.area ?? null, comite: null, puesto: null }
  if ('comite' in cambio) return { ...actual, comite: cambio.comite ?? null, puesto: null }
  return { ...actual, puesto: cambio.puesto ?? null }
}

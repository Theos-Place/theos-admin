/**
 * Reportar un error del servidor. UN SOLO LUGAR por donde pasa todo.
 *
 * POR QUÉ EXISTE. Las 338 rutas de `/api` atrapan sus propios errores en un
 * `catch`, escriben el log y devuelven un 500 con un mensaje humano. Eso está
 * bien para quien usa la app, pero significa que Next NUNCA ve la excepción:
 * cualquier servicio de errores enchufado al hook `onRequestError` se quedaría
 * vacío. Encendido y vacío es peor que apagado, porque da sensación falsa de
 * cobertura. Por eso el reporte se hace acá, a mano, en el `catch`.
 *
 * HOY LA OBSERVABILIDAD SON LOS LOGS DE VERCEL. El 2026-09-22 se decidió no
 * usar Sentry y se quitó el SDK: sin DSN era no-op, pero seguía costando bundle
 * del cliente, tiempo de build y una aprobación de install script. Observability
 * Plus, que ya viene en el plan de Vercel, cubre lo que hace falta.
 *
 * SI ALGÚN DÍA SE READOPTA UN SERVICIO DE ERRORES, SE RECONECTA ACÁ Y EN NINGÚN
 * OTRO LADO. Las ~360 llamadas a `reportarError` y `reportarFalla` que hay en el
 * código no se tocan: la firma es el contrato, y este archivo es la única
 * implementación.
 */

/**
 * @param contexto  Qué ruta y método falló. Va tal cual en el log; también se
 *                  normaliza con `etiquetaDeRuta` para poder agrupar por ruta.
 */
export function reportarError(contexto: string, error: unknown, datos?: Datos): void {
  if (datos) console.error(contexto, error, datos)
  else console.error(contexto, error)
}

/**
 * Datos sueltos del caso concreto: el id del pago, el nombre del bloque.
 *
 * Van aparte del contexto a propósito. Si algún día vuelve un agrupador, el
 * contexto es la etiqueta y esto el detalle: un id como etiqueta crearía un
 * grupo por fila y un problema —que es uno solo— se vería como mil incidentes.
 */
export type Datos = Record<string, unknown>

/** 'GET /api/members/[id]:' → 'GET /api/members/[id]'. Sin los dos puntos
 *  finales y acotada: es la forma normalizada de nombrar una ruta. */
export function etiquetaDeRuta(contexto: string): string {
  const limpio = contexto.trim().replace(/:$/, '').trim()
  return (limpio || 'sin-ruta').slice(0, 200)
}

/**
 * Reportar un fallo que NO viene como excepción, sino como un motivo en texto:
 * una subida de comprobante que devolvió error, una invitación que no salió.
 *
 * Son fallos PARCIALES — la operación principal sí tuvo éxito, así que la ruta
 * responde 200 y nadie se entera de que algo quedó a medias. Se distinguen de
 * `reportarError` para que no compitan con los 500 de verdad.
 */
export function reportarFalla(contexto: string, motivo: unknown, datos?: Datos): void {
  const linea = `${etiquetaDeRuta(contexto)}: ${textoDelMotivo(motivo)}`
  if (datos) console.warn(linea, datos)
  else console.warn(linea)
}

export function textoDelMotivo(motivo: unknown): string {
  if (typeof motivo === 'string') return motivo
  if (motivo instanceof Error) return motivo.message
  return String(motivo)
}

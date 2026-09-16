/**
 * Reportar un error del servidor: al log Y a Sentry.
 *
 * POR QUÉ HACE FALTA. Las 338 rutas de `/api` atrapan sus propios errores en un
 * `catch`, escriben un `console.error` y devuelven un 500 con un mensaje
 * humano. Eso está bien para quien usa la app, pero significa que Next NUNCA ve
 * la excepción — y el hook `onRequestError`, que es lo que conecta Next con
 * Sentry, solo se dispara con los errores que Next sí ve.
 *
 * O sea: con el DSN puesto y sin esto, Sentry no capturaría ni uno solo de los
 * errores de API. Estaría encendido y vacío, que es peor que apagado porque da
 * una sensación falsa de cobertura.
 *
 * El `console.error` se conserva a propósito: los logs de Vercel siguen siendo
 * donde se mira en caliente, y Sentry es el que agrupa, cuenta y avisa.
 */
import * as Sentry from '@sentry/nextjs'

/**
 * @param contexto  Qué ruta y método falló. Se usa tal cual en el log y, ya
 *                  sin los dos puntos finales, como etiqueta en Sentry para
 *                  poder filtrar por ruta.
 */
export function reportarError(contexto: string, error: unknown, datos?: Datos): void {
  if (datos) console.error(contexto, error, datos)
  else console.error(contexto, error)
  Sentry.captureException(error, { tags: { ruta: etiquetaDeRuta(contexto) }, extra: datos })
}

/**
 * Datos sueltos del caso concreto: el id del pago, el nombre del bloque.
 *
 * Van como `extra`, NUNCA como etiqueta. Sentry agrupa por etiqueta, así que un
 * id ahí crearía un grupo distinto por cada fila y el problema — que es uno
 * solo — se vería como mil incidentes de uno.
 */
export type Datos = Record<string, unknown>

/** 'GET /api/members/[id]:' → 'GET /api/members/[id]'. Sentry no acepta
 *  etiquetas vacías ni demasiado largas, así que además se acota. */
export function etiquetaDeRuta(contexto: string): string {
  const limpio = contexto.trim().replace(/:$/, '').trim()
  return (limpio || 'sin-ruta').slice(0, 200)
}

/**
 * Reportar un fallo que NO viene como excepción, sino como un motivo en texto:
 * una subida de comprobante que devolvió error, una invitación que no salió.
 *
 * Son fallos parciales — la operación principal sí tuvo éxito, así que la ruta
 * responde 200 y nadie se entera de que algo quedó a medias. Van a Sentry como
 * `warning`, no como error, para que no compitan con los 500 de verdad.
 */
export function reportarFalla(contexto: string, motivo: unknown, datos?: Datos): void {
  if (datos) console.error(contexto, motivo, datos)
  else console.error(contexto, motivo)
  Sentry.captureMessage(`${etiquetaDeRuta(contexto)}: ${textoDelMotivo(motivo)}`, {
    level: 'warning',
    tags: { ruta: etiquetaDeRuta(contexto) },
    extra: datos,
  })
}

export function textoDelMotivo(motivo: unknown): string {
  if (typeof motivo === 'string') return motivo
  if (motivo instanceof Error) return motivo.message
  return String(motivo)
}

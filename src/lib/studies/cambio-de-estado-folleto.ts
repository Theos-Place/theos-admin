/**
 * FOL-2 · Mover un tiquete de folletos de un estado a otro.
 *
 * DOS COSAS QUE ESTABAN MAL (reportadas el 2026-10-05):
 *
 *  1 · EL CAMBIO EN LOTE «NO GUARDABA». Sí guardaba — pero solo los tiquetes
 *      que estaban EXACTAMENTE en el estado anterior al elegido, por un
 *      `.eq('status', prev)` en la consulta. Al seleccionar varios en estados
 *      distintos, los que no calzaban se quedaban quietos y la pantalla
 *      decía «0 folletos → En impresión», que se lee como un éxito. Nadie
 *      podía saber CUÁLES no se movieron ni por qué.
 *
 *  2 · NO SE PODÍA RETROCEDER. Los errores de dedo existen, y un tiquete
 *      marcado «Enviado» por equivocación se quedaba así para siempre.
 *
 * Módulo PURO: define las reglas. Quien escribe es la query.
 */
import { FOLLETO_STATES, FOLLETO_STATE_LABEL, type FolletoState } from './folletos'

/** Posición en la cadena. -1 si el estado no existe. */
export function posicionDe(estado: string): number {
  return (FOLLETO_STATES as readonly string[]).indexOf(estado)
}

export function esAvance(desde: string, hasta: string): boolean {
  const a = posicionDe(desde), b = posicionDe(hasta)
  return a >= 0 && b >= 0 && b > a
}

export function esRetroceso(desde: string, hasta: string): boolean {
  const a = posicionDe(desde), b = posicionDe(hasta)
  return a >= 0 && b >= 0 && b < a
}

/**
 * Retroceder EXIGE una nota.
 *
 * Avanzar es el curso normal y pedir una justificación en cada paso sería
 * fricción pura. Retroceder es siempre la corrección de algo: dentro de un
 * mes, «¿por qué este tiquete volvió a Creada?» tiene que tener respuesta, y
 * la única persona que la sabe es la que lo movió.
 */
export function notaObligatoria(desde: string, hasta: string): boolean {
  return esRetroceso(desde, hasta)
}

export const MINIMO_DE_LA_NOTA = 5

/** null = se puede. Si no, por qué no. */
export function motivoQueImpide(input: {
  desde: string
  hasta: string
  nota?: string | null
}): string | null {
  if (posicionDe(input.hasta) < 0) return 'Ese estado no existe.'
  if (input.desde === input.hasta) return 'El tiquete ya está en ese estado.'
  if (posicionDe(input.desde) < 0) return 'El tiquete está en un estado desconocido.'
  if (notaObligatoria(input.desde, input.hasta)) {
    const n = (input.nota ?? '').trim()
    if (n.length < MINIMO_DE_LA_NOTA) {
      return 'Para devolver un tiquete hay que decir por qué.'
    }
  }
  return null
}

const etiqueta = (e: string): string =>
  FOLLETO_STATE_LABEL[e as FolletoState] ?? e

/** El texto de la confirmación. Nombra el SALTO, no pregunta «¿seguro?». */
export function textoDeConfirmacion(desde: string, hasta: string): string {
  const flecha = esRetroceso(desde, hasta) ? 'devolver de' : 'cambiar de'
  return `¿${flecha[0].toUpperCase()}${flecha.slice(1)} ${etiqueta(desde)} a ${etiqueta(hasta)}?`
}

/* ────────────────────────────────────────────────────────────────────────────
 * EFECTOS SECUNDARIOS
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Qué estado dispara algo además de cambiar la fila.
 *
 * HOY ES UNO SOLO: al pasar a «Enviado / Entregado» se le avisa al dirigente
 * que ya puede ir por sus folletos. Se censó el código y no hay otro.
 *
 * El cambio MANUAL no los vuelve a disparar, y por defecto: reenviarle el
 * aviso a un dirigente porque alguien corrigió un estado es spam, y el único
 * efecto que hay es justamente un correo a una persona. Si algún día se
 * quiere repetir a propósito, que sea una casilla explícita.
 */
export const ESTADOS_CON_EFECTO: ReadonlySet<string> = new Set(['enviado_entregado'])

export function disparaEfecto(hasta: string): boolean {
  return ESTADOS_CON_EFECTO.has(hasta)
}

/** Lo que se le dice a quien cambia a mano hacia un estado con efecto. */
export const AVISO_SIN_EFECTO =
  'El aviso al dirigente NO se vuelve a enviar: este cambio es manual.'

/* ────────────────────────────────────────────────────────────────────────────
 * EL LOTE
 * ──────────────────────────────────────────────────────────────────────────── */

export type ResultadoPorTiquete =
  | { id: string; movido: true; desde: string }
  | { id: string; movido: false; desde: string; motivo: string }

/**
 * El resumen del lote, en una línea.
 *
 * Dice CUÁNTOS de cuántos, y eso es el arreglo: «0 folletos → En impresión»
 * se leía como que había funcionado.
 */
export function resumenDelLote(
  resultados: readonly ResultadoPorTiquete[],
  etiquetaDestino: string,
): string {
  const movidos = resultados.filter(r => r.movido).length
  const total = resultados.length
  if (total === 0) return 'No había nada seleccionado.'
  if (movidos === total) {
    return `${movidos} folleto${movidos === 1 ? '' : 's'} → ${etiquetaDestino}.`
  }
  if (movidos === 0) {
    return `Ninguno cambió. ${resultados[0].movido === false ? resultados[0].motivo : ''}`.trim()
  }
  return `${movidos} de ${total} pasaron a ${etiquetaDestino}; ${total - movidos} no.`
}

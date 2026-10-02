/**
 * PAG-6 · El rango de fechas de la conciliación, en hora de Costa Rica.
 *
 * POR QUÉ ESTO NO ES UN `gte`/`lte` A SECAS. `payments.paid_at` es
 * `timestamptz` y el runtime corre en UTC, pero Andrés concilia contra el
 * ESTADO DE CUENTA, que viene en días de Costa Rica. Medido en producción el
 * 2026-10-02: hay pagos registrados a las 00:57 UTC, que son las 6:57 p.m.
 * del día ANTERIOR en Costa Rica (UTC-6, sin horario de verano).
 *
 * Con un filtro ingenuo —`lte('paid_at', '2026-09-30')`— ese pago del lunes
 * por la noche cae en el martes y, peor, el corte queda en la medianoche UTC:
 * el «hasta» se comería casi todo el último día. Los números no cuadrarían
 * contra el banco y el error sería silencioso: la pantalla mostraría una
 * lista perfectamente plausible, solo que con los pagos corridos un día.
 *
 * El fin del rango va al milisegundo .999 y no a las 23:59:59 «y ya»: un pago
 * registrado a las 23:59:59.4 existe, y perderlo es exactamente el tipo de
 * descuadre de un colón que obliga a revisar todo el mes a mano.
 */

/** Costa Rica es UTC-6 todo el año. No hay horario de verano que ajustar. */
const OFFSET_CR = '-06:00'

/**
 * `YYYY-MM-DD` que además EXISTE en el calendario.
 *
 * El regex solo no alcanza: «2026-13-45» lo pasa, y ese texto llegaría tal
 * cual a PostgREST. Se reconstruye la fecha y se compara contra la entrada
 * —así se caen el mes 13, el día 45 y el 30 de febrero, que el constructor
 * de Date acomoda en silencio al mes siguiente.
 */
const esYmd = (s: string | null | undefined): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Inicio del día (00:00:00 CR) de `YYYY-MM-DD`. `null` si no es una fecha. */
export function inicioDelDiaCR(ymd: string | null | undefined): string | null {
  return esYmd(ymd) ? `${ymd}T00:00:00.000${OFFSET_CR}` : null
}

/** Fin del día (23:59:59.999 CR) de `YYYY-MM-DD`. `null` si no es una fecha. */
export function finDelDiaCR(ymd: string | null | undefined): string | null {
  return esYmd(ymd) ? `${ymd}T23:59:59.999${OFFSET_CR}` : null
}

/**
 * Normaliza el par desde/hasta.
 *
 * Si vienen al revés los INTERCAMBIA en vez de devolver vacío: escribir
 * «del 30 al 1» es un error de dedo cotidiano, y una lista vacía se lee como
 * «no hubo pagos» —que es una respuesta falsa— en vez de como un rango mal
 * escrito.
 */
export function rangoDePago(desde?: string | null, hasta?: string | null): {
  desdeIso: string | null
  hastaIso: string | null
} {
  const a = esYmd(desde) ? desde : null
  const b = esYmd(hasta) ? hasta : null
  const [ini, fin] = a && b && a > b ? [b, a] : [a, b]
  return { desdeIso: inicioDelDiaCR(ini), hastaIso: finDelDiaCR(fin) }
}

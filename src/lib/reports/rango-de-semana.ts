/**
 * De una semana ISO a su rango de fechas, para que el reporte diga "14–20 set"
 * y no "Semana 38".
 *
 * POR QUÉ. El número ISO es una clave técnica, no información: nadie sabe qué
 * semana fue la 38. El caso que lo pidió fue querer ver si la caída de
 * Meridiano Martes desde la semana 26 coincidía con la apertura de los
 * miércoles — y para eso primero había que averiguar que la 26 fue el 22–28 de
 * junio.
 *
 * El número se conserva como dato secundario en el tooltip, nunca como etiqueta
 * principal.
 *
 * ISO DE VERDAD, que es donde esto se rompe: la semana 1 es la que contiene el
 * primer jueves de enero, así que puede arrancar en diciembre del año anterior,
 * y hay años de 53 semanas. Mezclar el año calendario con el año ISO ya causó
 * un bug en este mismo reporte (REP-3) y por eso el año de la etiqueta se
 * calcula desde la fecha real, no desde el parámetro `year`.
 */

/** Meses como se escriben en Costa Rica: SET, no SEP. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

export type RangoDeSemana = {
  /** Lunes, a medianoche de Costa Rica (06:00 UTC). Ver HORA_CR abajo. */
  desde: Date
  /** Domingo, a medianoche de Costa Rica. */
  hasta: Date
  /** "14–20 set", "28 set–4 oct", "29 dic 2025–4 ene 2026". */
  etiqueta: string
  /** Solo el lunes: "14 set". Para los ticks del eje, donde no cabe el rango. */
  etiquetaCorta: string
  /** "Semana 38 · 14–20 set". El número va detrás, nunca adelante. */
  conNumero: string
}

/**
 * Las fechas se construyen a medianoche de COSTA RICA (UTC-6), no a medianoche
 * UTC.
 *
 * Lo encontró un test de ida y vuelta: `semanaISO()` —la que ya usa el
 * reporte— convierte a hora de Costa Rica antes de calcular, así que un Date a
 * las 00:00 UTC le llega como las 18:00 del día ANTERIOR. Pasarle el lunes del
 * 2026-W01 devolvía 2025-W52. Con las fechas ancladas a medianoche CR las dos
 * funciones coinciden, y cualquiera que cruce una salida de acá con el resto
 * del reporte obtiene la semana correcta.
 */
const HORA_CR = 6

/** Lunes de la semana ISO (year, week), a medianoche de Costa Rica. */
export function lunesDeSemanaISO(year: number, week: number): Date {
  // El 4 de enero SIEMPRE cae en la semana 1 (definición ISO).
  const cuatroEne = new Date(Date.UTC(year, 0, 4, HORA_CR))
  const dia = cuatroEne.getUTCDay() || 7
  const lunesSemana1 = new Date(cuatroEne)
  lunesSemana1.setUTCDate(cuatroEne.getUTCDate() - dia + 1)
  const lunes = new Date(lunesSemana1)
  lunes.setUTCDate(lunesSemana1.getUTCDate() + (week - 1) * 7)
  return lunes
}

/**
 * @param anioDelReporte  si se pasa, el año solo aparece en la etiqueta cuando
 *   alguna punta del rango cae fuera de él (la semana 1 que arranca en
 *   diciembre, o la 52/53 que termina en enero). Sin él, nunca se muestra.
 */
export function rangoDeSemana(year: number, week: number, anioDelReporte?: number): RangoDeSemana {
  const desde = lunesDeSemanaISO(year, week)
  const hasta = new Date(desde)
  hasta.setUTCDate(desde.getUTCDate() + 6)

  const ref = anioDelReporte ?? year
  const mostrarAnio = desde.getUTCFullYear() !== ref || hasta.getUTCFullYear() !== ref

  const dia = (d: Date) => d.getUTCDate()
  const mes = (d: Date) => MESES[d.getUTCMonth()]
  const anio = (d: Date) => d.getUTCFullYear()

  const mismoMes = desde.getUTCMonth() === hasta.getUTCMonth() && desde.getUTCFullYear() === hasta.getUTCFullYear()
  const etiqueta = mismoMes
    // "14–20 set": el mes no se repite cuando es el mismo.
    ? `${dia(desde)}–${dia(hasta)} ${mes(hasta)}${mostrarAnio ? ' ' + anio(hasta) : ''}`
    : `${dia(desde)} ${mes(desde)}${mostrarAnio ? ' ' + anio(desde) : ''}–${dia(hasta)} ${mes(hasta)}${mostrarAnio ? ' ' + anio(hasta) : ''}`

  return {
    desde,
    hasta,
    etiqueta,
    etiquetaCorta: `${dia(desde)} ${mes(desde)}`,
    conNumero: `Semana ${week} · ${etiqueta}`,
  }
}

/** Atajo para "2026-W38". Devuelve null si la clave no se entiende. */
export function rangoDesdeClave(clave: string | null | undefined, anioDelReporte?: number): RangoDeSemana | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec((clave ?? '').trim())
  if (!m) return null
  const week = Number(m[2])
  if (week < 1 || week > 53) return null
  return rangoDeSemana(Number(m[1]), week, anioDelReporte)
}

/**
 * Desde cuándo cuenta una donación para que la persona sea "donante activo".
 *
 * La definición (decisión del usuario, 2026-09-16): donó al menos una vez en
 * los últimos 6 meses, contando el mes actual. O sea, desde el primer día del
 * mes que está 5 meses atrás.
 *
 * Esto existe para PONERLE FECHA AL NÚMERO en pantalla. "Últimos 6 meses" es
 * ambiguo —¿rodante?, ¿por mes calendario?— y la tarjeta del dashboard decía
 * antes "los últimos 2 trimestres", que ya ni siquiera era cierto. Mostrar
 * "desde abril de 2026" no se presta a interpretación.
 *
 * SE CALCULA EN UTC A PROPÓSITO. Quien manda es la base: la ventana la aplica
 * `refresh_donor_flags()` con `date_trunc('month', CURRENT_DATE)`, y la sesión
 * de Postgres corre en UTC. Costa Rica es UTC-6, así que el último día de cada
 * mes, entre las 6 p.m. y la medianoche, la base ya está en el mes siguiente y
 * su ventana se corrió. Si acá usáramos la fecha civil de Costa Rica, esas
 * seis horas la etiqueta diría un mes y el conteo sería de otro. Vale más que
 * el texto coincida con el número que mostrar el mes "correcto" para quien lee.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Primer día de la ventana, como fecha UTC (YYYY-MM-DD). */
export function inicioDeLaVentana(ahora: Date): string {
  const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 5, 1))
  return d.toISOString().slice(0, 10)
}

/** "abril de 2026" — el mes desde el que cuentan las donaciones. */
export function mesDeLaVentana(ahora: Date): string {
  const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 5, 1))
  return `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

/** La línea corta de la tarjeta del dashboard. */
export function subtituloDeDonantes(ahora: Date): string {
  return `Donaron desde ${mesDeLaVentana(ahora)}`
}

/** La explicación completa, para el panel de detalle y los tooltips. */
export function explicacionDeDonantes(ahora: Date): string {
  return `Donaron al menos una vez desde ${mesDeLaVentana(ahora)}: los últimos 6 meses, contando el actual.`
}

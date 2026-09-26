/**
 * Desde cuándo cuenta una donación para que la persona sea "donante activo".
 *
 * LA DEFINICIÓN (FIN-10, 2026-09-25): donó al menos una vez en el MES ACTUAL o
 * en los 3 MESES CALENDARIO anteriores. O sea, desde el primer día del mes que
 * está 3 meses atrás: el 25 de setiembre cuenta desde el 1 de junio.
 *
 * Son MESES CALENDARIO y no «90 días hacia atrás». La diferencia importa el día
 * 1: con días corridos, quien donó el 2 del mes pasado se cae de la lista a
 * mitad de este; con meses calendario la ventana se mueve de golpe y el criterio
 * se puede explicar en una frase.
 *
 * Fue 6 meses (2026-09-16), después 3 (PAR-1, 2026-09-23) y ahora 4. Antes de
 * todo eso la pantalla decía "2 trimestres", que ya ni era cierto.
 *
 * Esto existe para PONERLE FECHA AL NÚMERO en pantalla. "Últimos 3 meses" es
 * ambiguo —¿rodante?, ¿por mes calendario?— y mostrar "desde julio de 2026" no
 * se presta a interpretación.
 *
 * EL NÚMERO VIVE ACÁ Y EN UN SOLO LUGAR MÁS, que no se puede evitar: la función
 * `refresh_donor_flags()` de Postgres, que es la que realmente marca la bandera
 * —y que desde FIN-10 además extiende el estado al cónyuge—.
 * Un `.sql` no puede importar TypeScript. Lo que sí se puede es que no se
 * separen sin que nadie se entere, y de eso se encarga
 * `ventana-de-donante.test.ts`: lee la migración y falla si el `INTERVAL` no
 * coincide con `MESES_DE_VENTANA`. Antes de esto el número estaba escrito en
 * CUATRO lados —las dos funciones SQL, este archivo y una frase a mano en la
 * pantalla de finanzas— y cambiarlo era acordarse de los cuatro.
 *
 * SE CALCULA EN UTC A PROPÓSITO. Quien manda es la base: la ventana la aplica
 * `refresh_donor_flags()` con `date_trunc('month', CURRENT_DATE)`, y la sesión
 * de Postgres corre en UTC. Costa Rica es UTC-6, así que el último día de cada
 * mes, entre las 6 p.m. y la medianoche, la base ya está en el mes siguiente y
 * su ventana se corrió. Si acá usáramos la fecha civil de Costa Rica, esas
 * seis horas la etiqueta diría un mes y el conteo sería de otro. Vale más que
 * el texto coincida con el número que mostrar el mes "correcto" para quien lee.
 */

/** Cuántos meses mira la ventana, contando el actual. El único número. */
export const MESES_DE_VENTANA = 4

/** Cuántos meses hay que retroceder desde el actual. */
const RETROCESO = MESES_DE_VENTANA - 1

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Primer día de la ventana, como fecha UTC (YYYY-MM-DD). */
export function inicioDeLaVentana(ahora: Date): string {
  const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - RETROCESO, 1))
  return d.toISOString().slice(0, 10)
}

/** "julio de 2026" — el mes desde el que cuentan las donaciones. */
export function mesDeLaVentana(ahora: Date): string {
  const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - RETROCESO, 1))
  return `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

/** La línea corta de la tarjeta del dashboard. */
export function subtituloDeDonantes(ahora: Date): string {
  return `Donaron desde ${mesDeLaVentana(ahora)}`
}

/** La explicación completa, para el panel de detalle y los tooltips. */
export function explicacionDeDonantes(ahora: Date): string {
  return `Donaron al menos una vez desde ${mesDeLaVentana(ahora)}: los últimos ${MESES_DE_VENTANA} meses, contando el actual.`
}

/** La frase corta para una tarjeta, sin el mes. Existe para que la pantalla de
 *  finanzas no la vuelva a escribir a mano — ahí estaba duplicada. */
export function criterioDeDonantes(): string {
  return `Donaron en los últimos ${MESES_DE_VENTANA} meses, contando el actual`
}

/**
 * Una serie cuyas repeticiones se PISAN no es una serie: es el error de los dos
 * «fin» (ver fin-de-la-serie.ts) llegando hasta la base.
 *
 * LO QUE SE ENCONTRÓ (prod, 2026-10-15). Los 13 eventos recurrentes públicos
 * tenían este problema: «Cárcel de Menores», todos los viernes 15:30, con fin
 * el viernes SIGUIENTE a las 17:30. Cada repetición duraba siete días y dos
 * horas, y la siguiente empezaba antes de que terminara la anterior. Así se
 * exportaban al calendario de la gente: eventos de una semana.
 *
 * El aviso de «dura N días» ya existía y no alcanzó: se guardaba igual. La
 * diferencia con un retiro de fin de semana que se repite cada mes es medible
 * —ese dura dos días y la siguiente fecha está a treinta— así que esto sí se
 * bloquea: si una repetición dura lo mismo o más que el tiempo hasta la
 * siguiente, no se guarda.
 *
 * Módulo PURO. Usa la MISMA expansión que el calendario.
 */
import { expandRecurring } from './expand-recurrence'

export type Solapamiento = { duracionMs: number; separacionMs: number }

export function solapamientoDeLaSerie(e: {
  is_recurring?: boolean | null
  recurrence_rule?: string | null
  starts_at?: string | null
  ends_at?: string | null
  timezone?: string | null
}): Solapamiento | null {
  if (!e.is_recurring || !e.recurrence_rule || !e.starts_at || !e.ends_at) return null
  const inicio = new Date(e.starts_at)
  const fin = new Date(e.ends_at)
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return null
  const duracionMs = fin.getTime() - inicio.getTime()
  if (duracionMs <= 0) return null
  // Duración cero para expandir: solo interesan los inicios. Sin fin de serie,
  // un año alcanza para ver la separación más corta de cualquier regla semanal.
  const hasta = new Date(inicio.getTime() + 400 * 86_400_000)
  const inicios = [
    inicio.getTime(),
    ...expandRecurring({
      id: 'x', start_at: inicio.toISOString(), end_at: inicio.toISOString(),
      is_recurring: true, recurrence_rule: e.recurrence_rule, recurrence_end: null,
      timezone: e.timezone ?? null,
    }, inicio, hasta).map(o => new Date(o.start_at).getTime()),
  ].sort((a, b) => a - b)
  let separacionMs = Infinity
  for (let i = 1; i < inicios.length; i++) separacionMs = Math.min(separacionMs, inicios[i] - inicios[i - 1])
  if (!isFinite(separacionMs) || duracionMs < separacionMs) return null
  return { duracionMs, separacionMs }
}

const enPalabras = (ms: number) => {
  const horas = Math.round(ms / 3_600_000)
  if (horas < 48) return `${horas} horas`
  const dias = Math.floor(horas / 24)
  const resto = horas - dias * 24
  return resto ? `${dias} días y ${resto} horas` : `${dias} días`
}

export function mensajeDeSolapamiento(s: Solapamiento): string {
  return `Cada repetición duraría ${enPalabras(s.duracionMs)}, pero la siguiente empieza a los `
    + `${enPalabras(s.separacionMs)}: se pisarían. En «Fin» va la hora en que termina CADA `
    + 'repetición (normalmente el mismo día). Si es un solo evento de varios días seguidos, '
    + 'como un campamento, quitá la repetición.'
}

/**
 * REP-5 · Quiénes dejaron de venir después de una semana.
 *
 * LA PREGUNTA que contesta: "de los que vinieron la semana del 14 de setiembre,
 * ¿a quiénes no hemos vuelto a ver?". La lista se baja para llamarlos, así que
 * lo que importa es no meter a nadie que ya volvió.
 *
 * LA REGLA: asistió en la semana N y no tiene ningún check-in de charla en las
 * semanas N+1 a N+5 completas. Cinco semanas seguidas sin aparecer.
 *
 * SOLO SE EVALÚA SI LA SEMANA N+5 YA TERMINÓ. Antes de eso la respuesta no
 * existe todavía: alguien que "lleva 2 semanas sin venir" puede aparecer el
 * domingo. Mostrar una lista a medias que cambia sola es peor que decir cuánto
 * falta — quien la usa llama por teléfono, y llamar a quien vino ayer quema la
 * lista entera.
 *
 * VOLVER DESPUÉS NO LO SACA de la lista: la pregunta es quién cortó cinco
 * semanas tras la N, y eso ya pasó. Pero el regreso se muestra en su propia
 * columna, porque a quien ya volvió no hay que llamarlo.
 *
 * Módulo PURO: el caller trae las fechas y esto decide.
 */
import { lunesDeSemanaISO } from '@/lib/reports/rango-de-semana'

/** Cuántas semanas completas sin aparecer cuentan como abandono. */
export const SEMANAS_DE_CORTE = 5

export type VentanaDeAbandono = {
  /** Último día de la semana N+5, como 'YYYY-MM-DD'. */
  finDeLaVentana: string
  /** ¿Ya terminó la semana N+5? Si no, la lista no se puede calcular. */
  evaluable: boolean
  /** Cuántas semanas faltan para poder calcularla. 0 si ya se puede. */
  faltanSemanas: number
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Hasta cuándo hay que mirar, y si ya se puede.
 *
 * `hoy` entra por parámetro para poder probarlo; el caller le pasa la fecha de
 * Costa Rica (`todayCR()`), no `new Date()` crudo.
 */
export function ventanaDeAbandono(
  semana: { year: number; week: number },
  hoy: string,
  semanasDeCorte: number = SEMANAS_DE_CORTE,
): VentanaDeAbandono {
  // El domingo de la semana N+corte: lunes de esa semana más 6 días.
  const lunes = lunesDeSemanaISO(semana.year, semana.week)
  const finVentana = new Date(lunes)
  finVentana.setUTCDate(lunes.getUTCDate() + semanasDeCorte * 7 + 6)
  const finDeLaVentana = ymd(finVentana)

  const evaluable = hoy > finDeLaVentana
  if (evaluable) return { finDeLaVentana, evaluable, faltanSemanas: 0 }

  // Cuántas semanas completas faltan, redondeando hacia arriba: si faltan 3
  // días es "1 semana", porque la respuesta llega recién cuando cierra.
  const dias = Math.ceil((finVentana.getTime() - new Date(`${hoy}T00:00:00Z`).getTime()) / 86_400_000)
  return { finDeLaVentana, evaluable, faltanSemanas: Math.max(1, Math.ceil(dias / 7)) }
}

export type AsistenteDeLaSemana = {
  member_id: string
  nombre: string
  /** Sedes donde hizo check-in ESA semana. Puede ser más de una. */
  sedes: string[]
  telefono: string | null
  email: string | null
  /**
   * Fecha del primer check-in de charla DESPUÉS de la semana N, o null si no
   * volvió nunca.
   */
  regreso: string | null
}

export type Abandono = AsistenteDeLaSemana & {
  /** Fecha en que volvió, si volvió DESPUÉS de la ventana. null = no ha vuelto. */
  volvioEl: string | null
}

/** ¿Cortó las cinco semanas? `regreso` dentro de la ventana dice que no. */
export function esAbandono(regreso: string | null, finDeLaVentana: string): boolean {
  return regreso === null || regreso > finDeLaVentana
}

/**
 * Los que cortaron, en el orden en que conviene llamarlos: primero quienes NO
 * han vuelto, y dentro de cada grupo por nombre. A quien ya volvió no hay que
 * llamarlo, así que va al final en vez de quedar mezclado.
 */
export function abandonos(
  asistentes: readonly AsistenteDeLaSemana[],
  finDeLaVentana: string,
): Abandono[] {
  return asistentes
    .filter(a => esAbandono(a.regreso, finDeLaVentana))
    .map(a => ({ ...a, volvioEl: a.regreso }))
    .sort((x, y) => {
      if (!x.volvioEl !== !y.volvioEl) return x.volvioEl ? 1 : -1
      return x.nombre.localeCompare(y.nombre, 'es')
    })
}

/** La sede que se reporta: si asistió a varias esa semana, van todas separadas
 *  por coma. Elegir "la más frecuente" escondería que estuvo en dos, y quien
 *  llama necesita saber a cuál volvería. */
export function sedeDeLaSemana(sedes: readonly string[]): string {
  return [...new Set(sedes)].sort((a, b) => a.localeCompare(b, 'es')).join(', ')
}

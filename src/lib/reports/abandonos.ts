/**
 * REP-5 / REP-8 · Las dos listas de una semana: quiénes asistieron y quiénes
 * dejaron de venir.
 *
 * DOS DEFINICIONES QUE CAMBIARON EL 2026-09-21, y las dos por lo mismo — la
 * lista se baja para llamar por teléfono, así que lo que importa es a quién NO
 * hay que llamar.
 *
 * 1. ASISTENTE, no visitante. Solo cuenta quien ya vino al menos
 *    `VISITAS_MINIMAS` veces en total. Alguien que vino una sola vez y no
 *    volvió no es un asistente que se perdió: es alguien que visitó. Para esa
 *    pregunta está el reporte de personas nuevas, que además mide si volvió.
 *    Son números distintos y la pantalla muestra los dos: "889 check-ins · 826
 *    asistentes".
 *
 * 2. LA LISTA MIRA HACIA ATRÁS. Antes, al abrir la semana N se preguntaba
 *    quiénes de esa semana no volverían en las 5 siguientes — y eso no se podía
 *    contestar hasta que pasaran, así que la semana actual no tenía respuesta.
 *    Ahora, al abrir la semana N la lista es de quienes asistieron en la semana
 *    N-5 y no han vuelto desde entonces: EN la semana N cumplen cinco semanas
 *    sin aparecer. Siempre es calculable, incluso hoy.
 *
 * Volver después NO saca a nadie de la lista —cortó las cinco semanas y eso ya
 * pasó— pero el regreso va en su columna, porque a quien ya volvió no hay que
 * llamarlo.
 *
 * Módulo PURO: el caller trae las fechas y esto decide.
 */
import { lunesDeSemanaISO } from '@/lib/reports/rango-de-semana'

/** Cuántas semanas completas sin aparecer cuentan como que dejó de venir. */
export const SEMANAS_DE_CORTE = 5

/** Cuántas visitas hacen falta para contar como asistente y no como visitante. */
export const VISITAS_MINIMAS = 2

export const INFO_ASISTIERON =
  `Personas con check-in esta semana que han venido al menos ${VISITAS_MINIMAS} veces. `
  + 'Los que vienen por primera vez no se cuentan acá.'

/**
 * Dice el número UNA vez.
 *
 * Antes era "hace 5 semanas y dejaron de asistir las 5 semanas seguidas" y en
 * pantalla se leía "hace 5las 5" (reportado 2026-09-21): dos cincos en la misma
 * frase, con la segunda mitad repitiendo la primera. Una sola cadena, un solo
 * número.
 *
 * Y dice "hace N semanas", no "esta semana": esta gente justamente NO vino esta
 * semana. La fecha exacta va en el encabezado de la lista.
 */
export const INFO_DEJARON =
  `Vinieron hace ${SEMANAS_DE_CORTE} semanas y no han vuelto ninguna semana desde entonces, incluida esta.`

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type VentanaHaciaAtras = {
  /** La semana de la que salen los candidatos: N menos el corte. */
  semanaDeReferencia: { year: number; week: number }
  /** Lunes y domingo de esa semana, para pedir sus asistentes. */
  desde: string
  hasta: string
  /** Domingo de la semana N: si volvieron hasta acá, no cortaron. */
  finDeLaEspera: string
}

/**
 * De la semana que se está mirando a la semana que hay que consultar.
 *
 * Se resta en DÍAS sobre el lunes real y no en número de semana: restarle 5 al
 * número se rompe en enero, donde la semana 2 menos 5 no es la semana -3 sino
 * la 49 del año anterior.
 */
export function ventanaHaciaAtras(
  semana: { year: number; week: number },
  semanasDeCorte: number = SEMANAS_DE_CORTE,
): VentanaHaciaAtras {
  const lunesN = lunesDeSemanaISO(semana.year, semana.week)
  const lunesRef = new Date(lunesN)
  lunesRef.setUTCDate(lunesN.getUTCDate() - semanasDeCorte * 7)
  const domingoRef = new Date(lunesRef)
  domingoRef.setUTCDate(lunesRef.getUTCDate() + 6)
  const domingoN = new Date(lunesN)
  domingoN.setUTCDate(lunesN.getUTCDate() + 6)

  // El año ISO de la semana de referencia se toma de su jueves, que es la
  // definición: la semana pertenece al año donde cae su jueves.
  const jueves = new Date(lunesRef)
  jueves.setUTCDate(lunesRef.getUTCDate() + 3)
  const eneCuatro = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4, 6))
  const diaEne = eneCuatro.getUTCDay() || 7
  const lunesSemana1 = new Date(eneCuatro)
  lunesSemana1.setUTCDate(eneCuatro.getUTCDate() - diaEne + 1)
  const week = Math.round((lunesRef.getTime() - lunesSemana1.getTime()) / (7 * 86_400_000)) + 1

  return {
    semanaDeReferencia: { year: jueves.getUTCFullYear(), week },
    desde: ymd(lunesRef),
    hasta: ymd(domingoRef),
    finDeLaEspera: ymd(domingoN),
  }
}

export type AsistenteDeLaSemana = {
  member_id: string
  nombre: string
  /** Sedes donde hizo check-in esa semana. Puede ser más de una. */
  sedes: string[]
  telefono: string | null
  email: string | null
  /** Primer check-in de charla DESPUÉS de esa semana, o null si no volvió. */
  regreso: string | null
  /** Total histórico de check-ins a charlas. */
  visitas: number
}

export type Abandono = AsistenteDeLaSemana & {
  /** Fecha en que volvió, si volvió DESPUÉS de la espera. null = no ha vuelto. */
  volvioEl: string | null
}

/** ¿Es asistente y no alguien que pasó una vez? */
export function esAsistente(a: { visitas: number }): boolean {
  return a.visitas >= VISITAS_MINIMAS
}

/** Los asistentes de la semana: con check-in y con historia. */
export function asistentes(
  filas: readonly AsistenteDeLaSemana[],
): AsistenteDeLaSemana[] {
  return filas.filter(esAsistente)
}

/** ¿Cortó las cinco semanas? Un regreso dentro de la espera dice que no. */
export function esAbandono(regreso: string | null, finDeLaEspera: string): boolean {
  return regreso === null || regreso > finDeLaEspera
}

/**
 * Los que cortaron, en el orden en que conviene llamarlos: primero quienes NO
 * han vuelto, y dentro de cada grupo por nombre.
 *
 * Solo asistentes: quien vino una vez y no volvió es un visitante, no un
 * abandono.
 */
export function abandonos(
  filas: readonly AsistenteDeLaSemana[],
  finDeLaEspera: string,
): Abandono[] {
  return filas
    .filter(esAsistente)
    .filter(a => esAbandono(a.regreso, finDeLaEspera))
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

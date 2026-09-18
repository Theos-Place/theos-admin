/**
 * CHK-2 · "Esta persona cumple años esta semana": el aviso del check-in.
 *
 * POR QUÉ. Quien está en la fila del miércoles no tiene cómo saber que la
 * persona que acaba de marcar cumple años el sábado. El dato está en la ficha y
 * el momento de felicitar es ése, no un correo tres días después.
 *
 * LA SEMANA es de LUNES a DOMINGO, la del día del check-in. Se recorren los
 * siete días de verdad en vez de comparar "MM-DD entre A y B": la comparación
 * de texto se rompe en la semana que cruza el año (un cumpleaños el 02-01 es
 * "menor" que el 12-30 del lunes) y esa es justo la semana en la que más gente
 * anda felicitando.
 *
 * El 29 de FEBRERO no se resuelve acá: se le pregunta a `birthdayMatchDays`,
 * que ya decide que en un año no bisiesto esa gente se felicita el 28. Si algún
 * día esa regla cambia, cambia en un solo lugar y el aviso la sigue.
 *
 * Esto NO manda nada: es un aviso en pantalla. No depende de EMAIL_SILENT_MODE
 * ni del cron de saludos (DIR-2), que es otra cosa y sigue igual.
 */
import { birthdayMatchDays } from '@/lib/notifications/birthday-rules'

/** 'YYYY-MM-DD' (la ficha) o 'MM-DD' (lo que viaja al check-in: ver abajo). */
const CUMPLE = /^(?:\d{4}-)?(\d{2}-\d{2})$/
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/

export type AvisoDeCumple = {
  /** 'hoy' se dice distinto: es el único caso donde felicitar no es adelantarse. */
  cuando: 'hoy' | 'esta_semana'
  /** El día del cumpleaños DENTRO de esta semana, como fecha civil YYYY-MM-DD.
   *  Puede caer en otro año que `hoy` — la semana del 30 de diciembre. */
  fecha: string
}

/** El lunes de la semana que contiene esa fecha civil, en YYYY-MM-DD. */
function lunesDeLaSemana(ymd: string): Date {
  const [a, m, d] = ymd.split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d))
  // getUTCDay: 0 = domingo. El lunes es el inicio, así que el domingo retrocede 6.
  const desplazamiento = (dia.getUTCDay() + 6) % 7
  dia.setUTCDate(dia.getUTCDate() - desplazamiento)
  return dia
}

const aYmd = (d: Date): string => d.toISOString().slice(0, 10)

/**
 * @param cumpleanios 'YYYY-MM-DD' o 'MM-DD'. Las dos formas valen porque el
 *   año NO se usa para nada: solo el día y el mes. El buscador del check-in
 *   manda 'MM-DD' a propósito —el operador necesita saber el día, no la edad—,
 *   mientras que quien ya tiene la ficha en la mano pasa la fecha completa.
 * @param hoyYmd el día del check-in, fecha civil en hora de Costa Rica.
 * @returns el aviso, o null si no cumple esta semana / no hay fecha.
 */
export function cumpleEstaSemana(
  cumpleanios: string | null | undefined, hoyYmd: string,
): AvisoDeCumple | null {
  const m = cumpleanios ? CUMPLE.exec(cumpleanios) : null
  if (!m || !SOLO_FECHA.test(hoyYmd)) return null
  const cumpleMd = m[1]

  const lunes = lunesDeLaSemana(hoyYmd)
  for (let i = 0; i < 7; i++) {
    const dia = new Date(lunes)
    dia.setUTCDate(lunes.getUTCDate() + i)
    const ymd = aYmd(dia)
    // birthdayMatchDays devuelve qué MM-DD toca festejar ESE día: normalmente
    // uno, y dos el 28 de febrero de un año no bisiesto (suma el 02-29).
    if (birthdayMatchDays(ymd).includes(cumpleMd)) {
      return { cuando: ymd === hoyYmd ? 'hoy' : 'esta_semana', fecha: ymd }
    }
  }
  return null
}

/** El texto para el operador. Separado del cálculo para poder fijarlo en un
 *  test sin fabricar fechas, y porque la pantalla no debería redactar. */
export function textoDelCumple(nombre: string, aviso: AvisoDeCumple): string {
  if (aviso.cuando === 'hoy') return `¡Hoy es el cumpleaños de ${nombre}! Felicitalo 🎂`
  const [a, m, d] = aviso.fecha.split('-').map(Number)
  const cuando = new Date(Date.UTC(a, m - 1, d))
    .toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${nombre} cumple años el ${cuando} 🎂`
}

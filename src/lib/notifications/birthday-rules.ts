// DIR-2 · Reglas puras del saludo de cumpleaños.
//
// Todo lo que decide A QUIÉN se felicita hoy vive acá, sin Supabase, para poder
// testear el caso peludo: el 29 de febrero.

/** Tope de saludos por corrida. `sendSystemEmail` NO pasa por la cola de
 *  broadcasts, así que no consume ni respeta el límite diario de correos: este
 *  tope es la protección propia del cron. La audiencia real ronda los 2 por día
 *  (máximo histórico 6), así que 100 es holgado y a la vez frena cualquier
 *  disparo accidental (una fecha mal migrada que ponga a medio padrón el mismo
 *  día, por ejemplo). */
export const MAX_GREETINGS_PER_RUN = 100

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Qué "MM-DD" hay que felicitar hoy.
 *
 * Normalmente es uno solo: el de hoy. La excepción es el **29 de febrero**: en
 * los años que no son bisiestos esa fecha no existe, así que a esa gente se le
 * felicita el 28 — si no, se quedarían sin saludo tres de cada cuatro años.
 *
 * `todayYmd` en formato YYYY-MM-DD (hora de Costa Rica la resuelve el llamador).
 */
export function birthdayMatchDays(todayYmd: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return []
  const [y, m, d] = todayYmd.split('-').map(Number)
  const hoy = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // 28 de febrero de un año NO bisiesto: se suma la gente del 29.
  if (m === 2 && d === 28 && !isLeapYear(y)) return [hoy, '02-29']
  return [hoy]
}

export type BirthdayCandidate = {
  member_id: string
  email: string | null
  birth_date: string | null
  email_bounced?: boolean | null
  email_complained?: boolean | null
}

export type SkipReason = 'sin_correo' | 'rebotado' | 'queja' | 'sin_fecha'

/**
 * ¿Se le puede mandar el correo? El rebote permanente y la queja de spam
 * excluyen SIEMPRE: seguir escribiéndole a una dirección que rebotó quema la
 * reputación del dominio. (`sendSystemEmail` no filtra nada de esto por su
 * cuenta — hay que hacerlo acá.)
 */
export function greetingSkipReason(c: BirthdayCandidate): SkipReason | null {
  if (!c.birth_date) return 'sin_fecha'
  if (!c.email || !c.email.trim()) return 'sin_correo'
  if (c.email_bounced) return 'rebotado'
  if (c.email_complained) return 'queja'
  return null
}

/** Inicio del año en curso en hora CR — ventana del dedupe anual. */
export function yearStartIsoCR(todayYmd: string): string {
  return `${todayYmd.slice(0, 4)}-01-01T00:00:00-06:00`
}

/** Mes en curso como 'MM', para el resumen del día 1. */
export function monthOf(todayYmd: string): string {
  return todayYmd.slice(5, 7)
}

/** ¿Toca el resumen mensual al coordinador? (el día 1 de cada mes) */
export function isMonthlyDigestDay(todayYmd: string): boolean {
  return todayYmd.slice(8, 10) === '01'
}

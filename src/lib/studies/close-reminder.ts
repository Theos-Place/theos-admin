// DIR-3 · Cuándo recordarle al dirigente que tiene que cerrar su grupo.
//
// Dos avisos y no más:
//   1. Una semana ANTES de terminar → "te toca cerrar".
//   2. Una semana DESPUÉS de la fecha de fin, si el grupo sigue en curso →
//      "ya terminó y está pendiente", más aviso interno al coordinador.
// A partir de ahí es gestión humana: insistir por correo no lo va a resolver.
//
// Ojo con los nombres: la spec hablaba de `end_date` y `weeks`, pero las
// columnas reales son `study_groups.ends_at` y `study_plans.duration_weeks`.

/** Días de diferencia entre dos fechas YYYY-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)
  return Math.round(ms / 86400000)
}

/** Suma días a una fecha YYYY-MM-DD (en UTC, sin corrimientos de zona). */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/**
 * Fecha de fin del grupo.
 *
 * `ends_at` MANDA: es la explícita, la que alguien puso a propósito. Solo si no
 * está se calcula desde el inicio más las semanas del plan — el cálculo asume un
 * ritmo de una sesión por semana, que es lo que hay, pero por eso es el plan B.
 */
export function resolveEndDate(g: {
  ends_at?: string | null
  starts_at?: string | null
  plan_weeks?: number | null
}): string | null {
  const ends = (g.ends_at ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ends)) return ends

  const starts = (g.starts_at ?? '').slice(0, 10)
  const weeks = Number(g.plan_weeks ?? 0)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(starts) || !Number.isFinite(weeks) || weeks <= 0) return null
  return addDays(starts, weeks * 7)
}

/** Tope de grupos avisados por corrida. Hoy hay 71 grupos que dispararían aviso
 *  (36 próximos + 35 vencidos), o sea ~142 correos en la primera pasada: es
 *  legítimo, son cierres realmente pendientes. El tope está para que un dato
 *  malo (fechas migradas mal, por ejemplo) no se convierta en un bombardeo. Lo
 *  que no entra hoy sale mañana: el dedupe solo marca lo que sí se avisó. */
export const MAX_CLOSE_REMINDERS_PER_RUN = 60

/** Días de antelación del primer aviso. */
export const CLOSE_REMINDER_DAYS_BEFORE = 7
/** Días después del fin para el segundo y último aviso. */
export const CLOSE_OVERDUE_DAYS_AFTER = 7

export type CloseReminderKind = 'proximo' | 'vencido' | null

/**
 * Qué aviso corresponde hoy para este grupo, si alguno.
 *
 * - `proximo`: falta una semana o menos para terminar (y todavía no terminó).
 *   La ventana es "≤ 7 días", no "exactamente 7": si un día el cron no corre, el
 *   aviso igual sale al siguiente en vez de perderse. Antes de los 7 días, nada.
 * - `vencido`: ya pasaron 7 días o más desde el fin y el grupo sigue en curso.
 *
 * Los `*_sent` son las marcas de dedupe: un aviso ya mandado no se repite.
 */
export function closeReminderDue(input: {
  endDate: string | null
  todayYmd: string
  status: string
  proximoSent: boolean
  vencidoSent: boolean
}): CloseReminderKind {
  const { endDate, todayYmd, status } = input
  // Un grupo cerrado a tiempo no recibe nada.
  if (status !== 'en_curso') return null
  if (!endDate) return null

  const faltan = daysBetween(todayYmd, endDate)

  // Segundo aviso primero: si ya está vencido, el "próximo" perdió sentido.
  if (faltan <= -CLOSE_OVERDUE_DAYS_AFTER) return input.vencidoSent ? null : 'vencido'
  if (faltan <= CLOSE_REMINDER_DAYS_BEFORE) return input.proximoSent ? null : 'proximo'
  return null
}

// Programación de comunicados: convertir "3:30 p.m. en Madrid" a un instante.
//
// El formulario da dos cosas sueltas: un datetime-local ("2026-08-10T15:30",
// SIN zona) y una zona horaria elegida a mano. Interpretar ese texto con
// `new Date(...)` lo lee en la zona del NAVEGADOR de quien programa, que es
// justamente lo que no queremos: alguien en Costa Rica programando el envío de
// Madrid lo mandaría 8 horas tarde.

/** Estado de un comunicado que espera su hora. */
export const SCHEDULED_STATUS = 'scheduled'

/** Cada cuánto corre el cron. La hora elegida no es exacta: el envío sale en el
 *  primer tick posterior, así que hay que decirlo en la pantalla y no fingir
 *  precisión al minuto. */
export const TICK_MINUTES = 15

/**
 * Offset de una zona horaria (en minutos) en un instante dado. Sale de comparar
 * cómo Intl escribe ese mismo instante en la zona pedida contra UTC — es la
 * única forma sin librería de tener en cuenta el horario de verano (Madrid pasa
 * de +1 a +2 según el mes, y España sí lo aplica).
 */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(fmt.formatToParts(instant).map(x => [x.type, x.value])) as Record<string, string>
  // Date.UTC con los componentes "vistos" en esa zona: la diferencia contra el
  // instante real ES el offset.
  const asUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour === '24' ? '00' : p.hour), Number(p.minute), Number(p.second),
  )
  return (asUtc - instant.getTime()) / 60000
}

/**
 * "2026-08-10T15:30" + "Europe/Madrid" → el instante ISO en UTC.
 *
 * Se resuelve en dos pasos porque el offset depende del instante y el instante
 * depende del offset: se estima con el offset del primer intento y se corrige.
 * Devuelve null si el texto no es una fecha y hora válidas.
 */
export function zonedToUtc(localDateTime: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(localDateTime ?? '')
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const comoSiFueraUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
  if (!Number.isFinite(comoSiFueraUtc)) return null

  let instante = new Date(comoSiFueraUtc)
  for (let i = 0; i < 2; i++) {
    const off = zoneOffsetMinutes(instante, timeZone)
    instante = new Date(comoSiFueraUtc - off * 60000)
  }
  return instante.toISOString()
}

export type ScheduleError = 'sin_fecha' | 'fecha_invalida' | 'en_el_pasado'

export const SCHEDULE_MESSAGES: Record<ScheduleError, string> = {
  sin_fecha: 'Elegí la fecha y la hora del envío.',
  fecha_invalida: 'La fecha y hora del envío no son válidas.',
  en_el_pasado: 'La hora del envío ya pasó. Elegí un momento futuro.',
}

/**
 * Valida lo que eligió el usuario y devuelve el instante UTC a guardar.
 *
 * El margen: se rechaza lo que ya pasó, pero NO lo que cae dentro del próximo
 * tick — programar "en 5 minutos" es legítimo y sale en el siguiente barrido.
 */
export function resolveScheduledAt(
  localDateTime: string, timeZone: string, now: Date = new Date(),
): { ok: true; iso: string } | { ok: false; error: ScheduleError } {
  if (!localDateTime?.trim()) return { ok: false, error: 'sin_fecha' }
  const iso = zonedToUtc(localDateTime, timeZone)
  if (!iso) return { ok: false, error: 'fecha_invalida' }
  if (new Date(iso).getTime() <= now.getTime()) return { ok: false, error: 'en_el_pasado' }
  return { ok: true, iso }
}

/** ¿Le toca salir? El cron manda todo lo vencido, no solo lo del tick exacto:
 *  si un barrido falla, el siguiente recoge lo atrasado en vez de dejarlo
 *  colgado para siempre. */
export function isBroadcastDue(
  b: { status: string; scheduled_at: string | null }, now: Date = new Date(),
): boolean {
  if (b.status !== SCHEDULED_STATUS || !b.scheduled_at) return false
  const t = new Date(b.scheduled_at).getTime()
  return Number.isFinite(t) && t <= now.getTime()
}

/** Texto para la pantalla de confirmación, en la zona que eligió el usuario. */
export function scheduleSummary(iso: string, timeZone: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const fecha = d.toLocaleString('es-CR', {
    timeZone, day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return `${fecha} (${timeZone.split('/')[1]?.replace(/_/g, ' ') ?? timeZone})`
}

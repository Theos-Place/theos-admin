/**
 * El calendario público de Theos en formato iCalendar (RFC 5545), para
 * SUSCRIBIRSE desde Google Calendar, Apple Calendar u Outlook.
 *
 * POR QUÉ UN FEED Y NO UN ARCHIVO (2026-10-15, pedido de Floriana). El botón de
 * antes bajaba un .ics: una foto del momento. Un evento nuevo nunca llegaba al
 * calendario de nadie. Una suscripción es una URL que la app de calendario
 * vuelve a pedir sola, así que lo nuevo, lo movido y lo cancelado se ven sin
 * que la persona haga nada.
 *
 * LAS REPETICIONES VAN EXPANDIDAS, una VEVENT por fecha, con la MISMA
 * expansión que dibuja /calendario (`eventsInRange`). Se podía mandar la regla
 * (RRULE) y dejar que cada app la expanda, pero entonces habría dos motores
 * —el nuestro y el de Google— y el día que no coincidan (excepciones, la regla
 * propia `WEEKLY:TUE`, el horario de verano de Madrid) la persona vería en su
 * teléfono algo distinto de lo que publica Theos. Expandiendo acá, el feed es
 * lo que se ve en la cartelera, fecha por fecha.
 *
 * Las horas van en UTC (`...Z`): el instante es inequívoco y cada app lo pinta
 * en la zona de quien mira. Sin VTIMEZONE que mantener.
 *
 * Módulo PURO: sin red ni BD. Lo usa `GET /api/public/events.ics`.
 */

export type EventoParaIcs = {
  id: string
  name: string
  description?: string | null
  location?: string | null
  start_at: string
  end_at: string
  /** Presente en las repeticiones expandidas: el inicio identifica la fecha. */
  is_occurrence?: boolean
  updated_at?: string | null
}

export type OpcionesIcs = {
  /** Origen público del sitio, sin barra final: arma el link al detalle. */
  base: string
  /** Cuándo se generó: va en DTSTAMP. */
  ahora: Date
  nombre?: string
}

/**
 * Duración que se le da en el calendario a un evento SIN hora de fin (decisión
 * de Floriana, 2026-10-15: «una hora por defecto»). Sin esto aparecía como un
 * instante —sin bloque en la agenda—, y eran 109 de los 151 eventos recientes.
 *
 * Va SOLO en el feed y no se escribe en la base a propósito: la ventana del
 * check-in y el envío de la encuesta se calculan con `ends_at`, y ponérselo a
 * esos eventos cambiaría a qué hora cierra la puerta.
 */
export const DURACION_POR_DEFECTO_MS = 60 * 60 * 1000

/** Instante → `YYYYMMDDTHHMMSSZ`. */
export function fechaIcs(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Texto según RFC 5545 §3.3.11: barra, punto y coma, coma y saltos de línea. */
export function escaparTexto(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Plegado de líneas (RFC 5545 §3.1): ninguna línea pasa de 75 OCTETOS; la
 * continuación empieza con un espacio. Se cuenta en bytes UTF-8 y nunca se
 * corta un carácter por la mitad: «ñ» y las tildes son dos bytes, y un corte a
 * mitad deja un carácter roto en el calendario de la persona.
 */
export function plegar(linea: string): string {
  const enc = new TextEncoder()
  if (enc.encode(linea).length <= 75) return linea
  const partes: string[] = []
  let actual = ''
  let bytes = 0
  let limite = 75
  for (const ch of linea) {
    const n = enc.encode(ch).length
    if (bytes + n > limite) {
      partes.push(actual)
      actual = ''
      bytes = 0
      limite = 74 // la continuación ya gasta un byte en el espacio
    }
    actual += ch
    bytes += n
  }
  partes.push(actual)
  return partes.join('\r\n ')
}

/** UID estable: el mismo evento (o la misma fecha de una serie) da siempre el
 *  mismo UID, y por eso la app ACTUALIZA en vez de duplicar. */
export function uidDe(e: EventoParaIcs): string {
  return e.is_occurrence ? `${e.id}-${fechaIcs(e.start_at)}@theosplace.org` : `${e.id}@theosplace.org`
}

export function armarIcs(eventos: EventoParaIcs[], op: OpcionesIcs): string {
  const nombre = op.nombre ?? 'Theos Place'
  const lineas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Theos Place//Calendario publico//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparTexto(nombre)}`,
    'X-WR-TIMEZONE:America/Costa_Rica',
    // Cada cuánto volver a pedirlo. Apple y Outlook lo respetan; Google tiene
    // su propio ritmo y no se puede cambiar desde el feed.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ]
  const stamp = fechaIcs(op.ahora)
  for (const e of eventos) {
    const inicio = new Date(e.start_at)
    const fin = new Date(e.end_at)
    if (isNaN(inicio.getTime())) continue
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${uidDe(e)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fechaIcs(inicio)}`,
      `DTEND:${fechaIcs(!isNaN(fin.getTime()) && fin > inicio ? fin : new Date(inicio.getTime() + DURACION_POR_DEFECTO_MS))}`,
      `SUMMARY:${escaparTexto(e.name)}`,
      ...(e.description ? [`DESCRIPTION:${escaparTexto(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${escaparTexto(e.location)}`] : []),
      `URL:${op.base}/calendario/${e.id}`,
      ...(e.updated_at && !isNaN(new Date(e.updated_at).getTime()) ? [`LAST-MODIFIED:${fechaIcs(e.updated_at)}`] : []),
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    )
  }
  lineas.push('END:VCALENDAR')
  return lineas.map(plegar).join('\r\n') + '\r\n'
}

/** Los links para suscribirse, a partir de la URL https del feed. */
export function linksDeSuscripcion(feedHttps: string, nombre = 'Theos Place') {
  const webcal = feedHttps.replace(/^https?:\/\//, 'webcal://')
  return {
    webcal,
    // Google acepta el webcal:// en `cid` y abre «¿Agregar este calendario?».
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedHttps)}&name=${encodeURIComponent(nombre)}`,
    https: feedHttps,
  }
}

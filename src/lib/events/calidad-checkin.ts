/**
 * En qué calidad llegó la persona al evento: como asistente o como servidora.
 *
 * La pantalla ofrecía las dos opciones desde hacía tiempo, pero la elección no
 * salía del navegador — el POST no la mandaba. Se guardaba solo en el estado
 * optimista y se perdía al refrescar (verificado: 168.743 check-ins con `notes`
 * en NULL y event_volunteers vacío).
 *
 * SERVIR NO ES DEJAR DE ASISTIR. Quien atiende la mesa de bienvenida de una
 * charla estuvo en la charla: cuenta para la asistencia y para su elegibilidad
 * igual que cualquiera. Esta distinción es para que el encargado sepa con
 * cuánta gente contó, no para restarle nada a nadie — ver la nota en
 * src/lib/attendance.ts.
 */

export const CALIDADES_CHECKIN = ['asistente', 'servidor'] as const
export type CalidadCheckin = typeof CALIDADES_CHECKIN[number]

export function esCalidadValida(v: unknown): v is CalidadCheckin {
  return typeof v === 'string' && (CALIDADES_CHECKIN as readonly string[]).includes(v)
}

/** Lo que manda la pantalla ('participant' | 'server') traducido a lo que guarda
 *  la base. Son dos vocabularios distintos y conviene que la traducción esté en
 *  un solo lugar. */
export function calidadDesdeTipo(tipo: string | null | undefined): CalidadCheckin {
  return tipo === 'server' ? 'servidor' : 'asistente'
}

export type ConteoCalidad = {
  /** Todas las personas que estuvieron, sirvan o no. */
  total: number
  /** Las que llegaron a participar. */
  asistentes: number
  /** Las que llegaron a servir. */
  servidores: number
}

/**
 * Acepta los DOS vocabularios: `checked_in_as` ('servidor') como viene de la
 * base y `attendance_type` ('server') como lo expone el dominio. Es a propósito:
 * la alternativa era traducir en cada punto de llamada, que es exactamente cómo
 * se llega a que una pantalla cuente distinto que otra.
 */
export function contarPorCalidad(
  checkins: ReadonlyArray<{ checked_in_as?: string | null; attendance_type?: string | null }>,
): ConteoCalidad {
  let servidores = 0
  for (const c of checkins) {
    if (c.checked_in_as === 'servidor' || c.attendance_type === 'server') servidores++
  }
  return { total: checkins.length, asistentes: checkins.length - servidores, servidores }
}

/**
 * La línea del reporte.
 *
 * Sin servidores no se escribe "· 0 servidores": un cero ahí se lee como un
 * dato sobre la charla cuando en realidad, para todo lo anterior a hoy,
 * significa que no se medía.
 */
export function textoDeCalidad(c: ConteoCalidad): string {
  const gente = `${c.total} ${c.total === 1 ? 'asistente' : 'asistentes'}`
  if (c.servidores === 0) return gente
  return `${gente} · de los cuales ${c.servidores} ${c.servidores === 1 ? 'servidor' : 'servidores'}`
}

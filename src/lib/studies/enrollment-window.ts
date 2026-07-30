// GRU-1: ventana de matrícula de un grupo (módulo puro, cliente + servidor).
//
// Decisión de diseño: study_groups solo tiene 3 estados (en_matricula /
// en_curso / finalizado) y NO existe un estado "previo a matrícula", así que
// las fechas funcionan como VENTANA sobre el estado en_matricula:
//   · un grupo en_matricula solo acepta matrículas si hoy está dentro de la
//     ventana (sin fechas = siempre, comportamiento histórico);
//   · el cron diario cierra la matrícula (→ en_curso) cuando la ventana venció
//     y la fecha de inicio del grupo ya llegó;
//   · el cambio manual de estado SIEMPRE manda: el cron solo transiciona desde
//     el estado esperado (en_matricula) y nunca re-abre un grupo.

export function isEnrollmentWindowOpen(
  start: string | null | undefined,
  end: string | null | undefined,
  todayYmd: string,
): boolean {
  if (start && todayYmd < start) return false
  if (end && todayYmd > end) return false
  return true
}

/** ¿El cron debe pasar este grupo a en_curso? Solo si sigue en_matricula (el
 *  estado esperado para la fecha), su ventana venció y el grupo ya inició. Si
 *  no tiene fecha de inicio (o es futura), NO se transiciona: la ventana ya
 *  impide matricular y el arranque queda en manos del coordinador. */
export function shouldCloseEnrollment(
  g: { status: string; enrollment_end_date: string | null; starts_at: string | null },
  todayYmd: string,
): boolean {
  return g.status === 'en_matricula'
    && !!g.enrollment_end_date && todayYmd > g.enrollment_end_date
    && !!g.starts_at && g.starts_at.slice(0, 10) <= todayYmd
}

/** Ventana por defecto al crear un grupo: hoy → hoy (siempre editable). */
export function defaultEnrollmentWindow(todayYmd: string): { start: string; end: string } {
  return { start: todayYmd, end: todayYmd }
}

/** Mínimo del input "fin de matrícula": nunca antes del inicio de matrícula ni
 *  antes de hoy (la ventana se cierra hacia el futuro). */
export function minEnrollmentEnd(startYmd: string | null | undefined, todayYmd: string): string {
  const s = (startYmd ?? '').slice(0, 10)
  return s && s > todayYmd ? s : todayYmd
}

/** Máximo del input "fin de matrícula": la fecha de inicio del grupo, SOLO si
 *  es futura. Si el grupo arranca hoy o ya arrancó (p. ej. se registra un grupo
 *  en curso), no se acota — antes ese caso dejaba el campo inservible: el
 *  navegador bloqueaba toda fecha futura y el server devolvía 400. */
export function maxEnrollmentEnd(groupStart: string | null | undefined, todayYmd: string): string | undefined {
  const g = (groupStart ?? '').slice(0, 10)
  return g && g > todayYmd ? g : undefined
}

/** Validación compartida de las fechas (forms + rutas). Espejo exacto de los
 *  límites del input: inicio <= fin, y fin <= inicio del grupo SOLO si el grupo
 *  arranca en el futuro. `todayYmd` se inyecta para poder testear. */
export function validateEnrollmentDates(input: {
  enrollment_start_date?: string | null
  enrollment_end_date?: string | null
  starts_at?: string | null
}, todayYmd?: string): string | null {
  const s = input.enrollment_start_date ?? null
  const e = input.enrollment_end_date ?? null
  if (s && e && s > e) return 'El inicio de matrícula no puede ser después del fin de matrícula.'
  const today = todayYmd ?? new Date().toISOString().slice(0, 10)
  const maxEnd = maxEnrollmentEnd(input.starts_at, today)
  if (e && maxEnd && e > maxEnd) {
    return 'El fin de matrícula no puede ser después de la fecha de inicio del grupo.'
  }
  return null
}

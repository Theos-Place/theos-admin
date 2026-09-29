import 'server-only'

/**
 * Ping de health check al terminar OK un cron (Healthchecks.io, Cronitor o
 * similar: si el ping no llega en la ventana esperada, el servicio alerta por
 * correo). Modo de fallo ya sufrido: "el cron falla y nadie se entera".
 *
 * Best-effort y no-op si la variable no está configurada — los crons nunca
 * deben fallar por culpa del monitoreo.
 */
export async function pingHealthcheck(envKey: 'HEALTHCHECK_URL_FOLLETO_BLOCKS' | 'HEALTHCHECK_URL_START_REMINDERS' | 'HEALTHCHECK_URL_LEADER_ABSENCE' | 'HEALTHCHECK_URL_STORAGE_ORPHANS' | 'HEALTHCHECK_URL_PAYMENT_HOLDS_EXPIRE' | 'HEALTHCHECK_URL_GROUP_WINDOWS' | 'HEALTHCHECK_URL_PAYMENT_REMINDERS'
  | 'HEALTHCHECK_URL_BIRTHDAYS'
  | 'HEALTHCHECK_URL_CLOSE_REMINDERS'
  | 'HEALTHCHECK_URL_EVENT_SURVEYS' | 'HEALTHCHECK_URL_REPORT_SNAPSHOTS' | 'HEALTHCHECK_URL_STUDY_SURVEYS'
  | 'HEALTHCHECK_URL_SCHEDULED_BROADCASTS'
  | 'HEALTHCHECK_URL_CUENTAS_SIN_FICHA'
  | 'HEALTHCHECK_URL_STUDY_REQUESTS_EXPIRE'
  | 'HEALTHCHECK_URL_STUDY_REQUESTS_WAKE'
  | 'HEALTHCHECK_URL_DESBLOQUEAR_MAYORES'
  | 'HEALTHCHECK_URL_DIRIGENTES_ACTIVOS'
  | 'HEALTHCHECK_URL_EVALUATION_DIGEST'): Promise<void> {
  const url = process.env[envKey]
  if (!url) {
    /**
     * SE AVISA, no se calla.
     *
     * Hasta el 2026-09-28 esto era un `return` mudo, y por eso 17 de los 19
     * monitores quedaron en «Never» sin que nadie pudiera saber cuáles: el
     * cron corría bien, el ping no salía, y en los logs no quedaba nada. El
     * motivo resultó ser que las variables estaban cargadas en Vercel en
     * MINÚSCULA (`HEALTHCHECK_URL_close_reminders`) y `process.env` distingue
     * mayúsculas — un error que una línea de log habría delatado el primer día.
     *
     * Sigue siendo best-effort: el cron NO falla por culpa del monitoreo.
     */
    console.warn(
      `healthcheck: ${envKey} no configurada — el cron corrió, pero el ping no se envió.`,
    )
    return
  }
  try {
    // La URL TAL CUAL, sin sufijos: Healthchecks.io usa /start, /fail y /log
    // como rutas aparte, y acá solo se reporta el final feliz.
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) })
    // Un 404 del monitor (check borrado, UUID mal copiado) devuelve 200 en la
    // red y falla igual: sin esto se vería como éxito.
    if (!res.ok) console.warn(`healthcheck: ${envKey} respondió ${res.status}`)
  } catch (e) {
    console.warn(`healthcheck: ${envKey} no se pudo enviar:`, e)
  }
}

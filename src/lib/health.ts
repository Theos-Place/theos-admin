import 'server-only'

/**
 * Ping de health check al terminar OK un cron (Healthchecks.io, Cronitor o
 * similar: si el ping no llega en la ventana esperada, el servicio alerta por
 * correo). Modo de fallo ya sufrido: "el cron falla y nadie se entera".
 *
 * Best-effort y no-op si la variable no está configurada — los crons nunca
 * deben fallar por culpa del monitoreo.
 */
export async function pingHealthcheck(envKey: 'HEALTHCHECK_URL_FOLLETO_BLOCKS' | 'HEALTHCHECK_URL_START_REMINDERS' | 'HEALTHCHECK_URL_LEADER_ABSENCE' | 'HEALTHCHECK_URL_STORAGE_ORPHANS' | 'HEALTHCHECK_URL_PAYMENT_HOLDS_EXPIRE' | 'HEALTHCHECK_URL_GROUP_WINDOWS' | 'HEALTHCHECK_URL_PAYMENT_REMINDERS'): Promise<void> {
  const url = process.env[envKey]
  if (!url) return
  try {
    await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) })
  } catch (e) {
    console.warn(`pingHealthcheck ${envKey}:`, e)
  }
}

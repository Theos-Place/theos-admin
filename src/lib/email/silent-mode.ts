// MIG-1 Etapa 0 · Modo silencioso de correos.
//
// El sistema todavía no debe escribirle a los miembros: lo que hay es prueba de
// procesos. Y una operación de datos puede disparar envíos sola — importar
// grupos finalizados hace que el cron de encuestas los vea como recién cerrados,
// los pagos pendientes alimentan el recordatorio de los lunes, y
// start-reminders / folleto-blocks / event-surveys corren a diario.
//
// EL GUARD VA EN UN SOLO LUGAR: sendEmail() en provider.ts, por donde pasa
// absolutamente todo. Ni cron por cron ni caso por caso — un camino nuevo de
// envío queda cubierto sin que nadie se acuerde de nada.
//
// LA EXCEPCIÓN, y solo esta: los correos para ENTRAR al sistema (definir o
// restablecer contraseña, reenviar la activación). El staff los necesita para
// trabajar, y no los dispara ningún cron ni ningún import: siempre son una
// persona pidiendo acceso o alguien del staff apretando un botón para UN
// miembro. Se marcan con `authCritical: true` en el call site —a propósito
// explícito, para que `grep authCritical` liste la excepción completa— en vez de
// adivinar por el asunto, que se rompería con cualquier cambio de copy.

/** ¿Está encendido el modo silencioso? */
export function isEmailSilentMode(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.EMAIL_SILENT_MODE ?? '').trim().toLowerCase()
  // Explícito y corto: solo estos cuatro encienden. Un '0', un 'false' o vacío
  // dejan el sistema enviando, que es el estado normal.
  return v === '1' || v === 'true' || v === 'yes' || v === 'si'
}

export type SilentDecision =
  /** Se envía de verdad. */
  | 'enviar'
  /** No se envía: se registra qué habría salido. */
  | 'silenciar'

/**
 * Qué hacer con este correo.
 *
 * Con el modo apagado, todo se envía. Con el modo encendido, solo pasan los
 * correos de acceso.
 */
export function silentDecision(input: {
  silent: boolean
  authCritical?: boolean
}): SilentDecision {
  if (!input.silent) return 'enviar'
  return input.authCritical ? 'enviar' : 'silenciar'
}

/** Aviso para los logs. Lleva destinatario y asunto, que es lo que se revisa en
 *  el reporte de las últimas 24 h antes de apagar el modo. */
export function silentLogLine(to: string, subject: string): string {
  return `[EMAIL_SILENT_MODE] NO enviado → ${to} · ${subject}`
}

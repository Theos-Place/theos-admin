/**
 * ¿El correo salió de verdad?
 *
 * BEC-3 (2026-09-11). `sendEmail` tiene dos caminos que NO envían y que aun así
 * devuelven sin error: el modo silencioso (MIG-1) y los dominios `.invalid` de
 * las cuentas de prueba. Quien llamaba veía "sin error" y lo tomaba por
 * enviado, así que estampaba `email_sent_at` igual.
 *
 * El resultado era una pantalla que miente: la beca de Valeria decía "último
 * envío" con fecha y hora de un correo que nunca salió, y el botón cambiaba a
 * "Reenviar correo". Peor que no registrar nada, porque nadie vuelve a mirar
 * algo que ya dice hecho.
 *
 * Este módulo es la única definición de "salió": lo demás pregunta acá.
 */

/** Por qué no salió. */
export type MotivoOmitido = 'modo_silencioso' | 'dominio_invalido'

/** messageId que devuelve sendEmail cuando NO envió. Son los que ya usaba el
 *  provider: se centralizan acá para que no queden sueltos como strings. */
export const MESSAGE_ID_OMITIDO: Record<MotivoOmitido, string> = {
  modo_silencioso: 'skipped-silent-mode',
  dominio_invalido: 'skipped-invalid-domain',
}

export type ResultadoEnvio = {
  /** false = no salió ningún correo, aunque no haya habido error. */
  enviado: boolean
  /** Por qué no salió. null cuando sí salió. */
  motivo: MotivoOmitido | null
}

export const ENVIADO: ResultadoEnvio = { enviado: true, motivo: null }

export function omitido(motivo: MotivoOmitido): ResultadoEnvio {
  return { enviado: false, motivo }
}

/** Interpreta un messageId. Se usa para los llamadores que solo tienen eso. */
export function resultadoDeMessageId(messageId: string): ResultadoEnvio {
  for (const [motivo, id] of Object.entries(MESSAGE_ID_OMITIDO) as [MotivoOmitido, string][]) {
    if (messageId === id) return omitido(motivo)
  }
  return ENVIADO
}

/**
 * ¿Se anota la fecha de envío?
 *
 * Solo si salió. Un correo silenciado no deja rastro de envío: cuando se apague
 * el modo hay que poder mandarlo, y el botón tiene que seguir diciendo "Enviar"
 * y no "Reenviar".
 */
export function seRegistraElEnvio(r: ResultadoEnvio): boolean {
  return r.enviado
}

/** Qué se le dice a quien apretó el botón cuando no salió. */
export function mensajeDeOmision(motivo: MotivoOmitido): string {
  return motivo === 'modo_silencioso'
    ? 'El sistema está en modo silencioso y el correo no se envió. Se registró en el log de silenciados; volvé a intentarlo cuando el modo esté apagado.'
    : 'Esa dirección es de una cuenta de prueba y no recibe correos.'
}

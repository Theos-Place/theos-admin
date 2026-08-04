/**
 * El ID con el que SES identifica un correo, sacado de la respuesta del SMTP.
 *
 * POR QUÉ EXISTE: nodemailer devuelve en `info.messageId` el header Message-ID que
 * él mismo generó (`<uuid@theosplace.org>`), pero SES lo reemplaza por el suyo y
 * es ESE el que llega en los eventos de SNS (`mail.messageId`). Guardando el de
 * nodemailer, el webhook de entregas/rebotes buscaba por provider_message_id, no
 * encontraba nunca y caía al plan B — emparejar por dirección, que agarra el
 * último envío a ese correo y puede marcar el equivocado si van dos seguidos.
 *
 * SES lo devuelve al aceptar el mensaje:
 *   250 Ok 0100019fca782e02-c4b6abfc-5e3f-45ba-a7a8-f637b782562a-000000
 *
 * En SNS ese mismo valor viene pelado, sin <> ni dominio, así que es la forma que
 * se guarda.
 */

/** Un ID de SES: bloque hex, un UUID y un sufijo numérico, todo en minúscula. */
const SES_ID = /^[0-9a-f]{12,}(?:-[0-9a-f]+){5,}$/

/** Quita `<>` y el `@email.amazonses.com` si el valor viene como Message-ID. */
function pelar(v: string): string {
  return v.trim().replace(/^<|>$/g, '').replace(/@.*$/, '')
}

/**
 * Devuelve el ID de SES, o null si la respuesta no lo trae (otro proveedor SMTP,
 * un formato nuevo, o un valor que no tiene pinta de ID de SES). Null significa
 * "no lo sé": el caller se queda con lo que tenía en vez de guardar basura.
 */
export function sesMessageIdFromResponse(response?: string | null): string | null {
  if (!response) return null
  // El último token de la respuesta: "250 Ok <id>" y variantes de mayúsculas.
  const token = response.trim().split(/\s+/).pop()
  if (!token) return null
  const id = pelar(token).toLowerCase()
  return SES_ID.test(id) ? id : null
}

/**
 * Normaliza un ID que viene de un evento de SNS a la misma forma con la que se
 * guardó. SNS lo manda pelado, pero así el emparejamiento no depende de eso.
 */
export function normalizeSesMessageId(v?: string | null): string | null {
  if (!v) return null
  const id = pelar(v).toLowerCase()
  return id || null
}

/**
 * El valor a guardar en provider_message_id: el de SES si se pudo leer, y si no
 * el Message-ID local pelado — sigue sirviendo para rastrear a mano, aunque no
 * empareje con SNS.
 */
export function providerMessageId(response?: string | null, fallbackMessageId?: string | null): string {
  return sesMessageIdFromResponse(response) ?? (fallbackMessageId ? pelar(fallbackMessageId) : '')
}

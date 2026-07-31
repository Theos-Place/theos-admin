// De qué tipo es un correo: CAMPAÑA (respeta las bajas del newsletter y lleva
// el pie de "cancelar suscripción") o AVISO (llega siempre, sin pie de baja).
//
// Decisión 2026-07-31: quien redacta NO elige entre "marketing" y
// "transaccional" — el tipo se INFIERE de la plantilla, que es donde ya vive la
// intención (las del sistema y las de inscripción/bienvenida son avisos; las
// generales son campañas). Queda una sola casilla de escape para el caso raro.
// Los valores siguen siendo 'marketing' | 'transactional' porque así se guardan
// en message_broadcasts.kind y así los lee el envío.

export type EmailKind = 'marketing' | 'transactional'

/** Categorías de plantilla que son un AVISO personal, no una campaña. */
const NOTICE_CATEGORIES = new Set(['transaccional', 'inscripcion', 'bienvenida'])

export type TemplateKindInput = {
  is_system?: boolean | null
  category?: string | null
} | null | undefined

/** Tipo inferido. Sin plantilla asume CAMPAÑA: es el default seguro — respeta
 *  las bajas y lleva el pie de baja; equivocarse al revés le manda promoción a
 *  quien pidió no recibirla (quejas de spam → reputación del dominio). */
export function inferEmailKind(template: TemplateKindInput): EmailKind {
  if (!template) return 'marketing'
  if (template.is_system) return 'transactional'
  const cat = (template.category ?? '').trim().toLowerCase()
  return NOTICE_CATEGORIES.has(cat) ? 'transactional' : 'marketing'
}

/** ¿Este tipo llega también a quien se dio de baja del newsletter? */
export function reachesUnsubscribed(kind: EmailKind): boolean {
  return kind === 'transactional'
}

/** Texto que explica, en la pantalla de redacción, qué va a pasar al enviar. */
export function emailKindNotice(kind: EmailKind): string {
  return kind === 'marketing'
    ? 'Este comunicado se manda como campaña: respeta las bajas del newsletter y lleva el pie de "cancelar suscripción".'
    : 'Este comunicado se manda como aviso: llega también a quien se dio de baja del newsletter y no lleva pie de baja.'
}

export const NOTICE_OVERRIDE_LABEL = 'Es un aviso necesario, no una campaña'
export const NOTICE_OVERRIDE_HINT = 'Marcalo solo si la persona necesita este correo sí o sí (una selección, un pago, un trámite). Así llega también a quien se dio de baja.'

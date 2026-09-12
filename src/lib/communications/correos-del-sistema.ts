/**
 * Los correos que manda el sistema SOLO (avisos automáticos), no las campañas.
 *
 * Qué los distingue: `message_logs.broadcast_id` nulo. Una campaña sale de
 * /comunicaciones y alguien la escribió; estos los dispara el sistema —matrícula
 * confirmada, beca aprobada, enlace de contraseña, recordatorio de cierre— y
 * hasta ahora no se veían en ningún lado. Cuando alguien decía "no me llegó",
 * la respuesta salía de deducir.
 *
 * Los SILENCIADOS son la otra mitad de la historia y viven en otra tabla
 * (`silenced_emails`): el modo silencioso corta el envío antes de que exista
 * una fila en message_logs, así que un correo silenciado no aparece como
 * fallido — no aparece. Por eso son un estado del filtro y no una fila más.
 */

export type EstadoCorreo = 'delivered' | 'sent' | 'bounced' | 'failed' | 'pending' | 'silenciado'
export type FiltroCorreo = EstadoCorreo | 'todos' | 'problemas'

export type CorreoDelSistema = {
  id: string
  /** Nombre de la persona, si el correo coincide con una ficha. */
  persona: string | null
  destinatario: string
  asunto: string
  /** ISO. Para un silenciado es cuándo se intentó. */
  fecha: string | null
  estado: EstadoCorreo
  /** Lo que dijo el proveedor cuando falló. */
  error: string | null
}

export const ETIQUETA_ESTADO: Record<EstadoCorreo, string> = {
  delivered: 'Entregado',
  sent: 'Enviado',
  bounced: 'Rebotó',
  failed: 'Falló',
  pending: 'En cola',
  silenciado: 'No salió',
}

/** Verde entregado, navy en tránsito, coral lo que salió mal, ámbar lo que
 *  espera. "No salió" va en ámbar y no en coral: no es un error, es una
 *  decisión del modo silencioso. */
export const BADGE_ESTADO: Record<EstadoCorreo, string> = {
  delivered: 'bg-teal-soft/30 text-teal-deep',
  sent: 'bg-navy/10 text-navy',
  bounced: 'bg-coral-soft/20 text-coral',
  failed: 'bg-coral-soft/20 text-coral',
  pending: 'bg-amber-50 text-amber-700',
  silenciado: 'bg-amber-50 text-amber-700',
}

/** Qué se explica de cada estado, para que no haya que adivinar la diferencia
 *  entre "enviado" y "entregado", que es la pregunta que siempre aparece. */
export const AYUDA_ESTADO: Record<EstadoCorreo, string> = {
  delivered: 'El servidor del destinatario lo aceptó.',
  sent: 'Salió de acá; todavía no llegó la confirmación de entrega.',
  bounced: 'La dirección lo rechazó. Casi siempre está mal escrita o ya no existe.',
  failed: 'No se pudo enviar.',
  pending: 'Está en la cola de envío.',
  silenciado: 'El modo silencioso estaba encendido: el correo no se mandó.',
}

/** Estados que piden que alguien haga algo. */
export const ESTADOS_CON_PROBLEMA: EstadoCorreo[] = ['bounced', 'failed', 'silenciado']

export const FILTROS_CORREO: Array<{ id: FiltroCorreo; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'problemas', label: 'Con problema' },
  { id: 'delivered', label: 'Entregados' },
  { id: 'silenciado', label: 'No salieron' },
]

/** Normaliza lo que hay en la BD. Un estado que no conocemos se muestra como
 *  'sent' y no se esconde: preferimos una fila con la etiqueta imprecisa a una
 *  fila que desaparece. */
export function estadoDeLaFila(status: string | null | undefined): EstadoCorreo {
  const s = String(status ?? '').toLowerCase()
  if (s === 'delivered' || s === 'bounced' || s === 'failed' || s === 'pending') return s
  return 'sent'
}

export function esProblema(e: EstadoCorreo): boolean {
  return ESTADOS_CON_PROBLEMA.includes(e)
}

/** Qué estados pide un filtro. `null` = el filtro no consulta message_logs
 *  (los silenciados salen de su propia tabla). */
export function estadosDelFiltro(f: FiltroCorreo): EstadoCorreo[] | null {
  if (f === 'todos') return []                      // sin condición
  if (f === 'silenciado') return null
  if (f === 'problemas') return ['bounced', 'failed']
  return [f]
}

export function textoVacio(f: FiltroCorreo, hayBusqueda: boolean): string {
  if (hayBusqueda) return 'Nada que coincida con la búsqueda.'
  if (f === 'problemas') return 'Ningún correo del sistema falló ni rebotó.'
  if (f === 'silenciado') return 'No hay correos retenidos por el modo silencioso.'
  return 'Todavía no hay correos del sistema.'
}

/**
 * SOP-3 (2026-10-29) · Aviso interno cuando nace un tiquete de soporte.
 *
 * Antes el tiquete entraba a la cola y nadie se enteraba hasta abrir
 * /soporte. Floriana: «una notificación automática a todos los admin y a los
 * usuarios de soporte». Mismo molde que las solicitudes de estudio: una
 * notificación interna (la campana) por destinatario; a quien lo levantó no
 * se le avisa de lo que acaba de hacer.
 *
 * Módulo PURO: quién recibe y qué dice. La consulta vive en queries/support-tickets.
 */
import { SOPORTE_ROLES } from './tiquete'

export type FilaDeRol = {
  member_id: string
  role: string
  role_active: boolean
  member_active: boolean
}

/** Miembros activos con rol activo de soporte técnico o admin, sin repetir. */
export function destinatariosDeTiquete(
  rows: readonly FilaDeRol[],
  opts: { excludeMemberId?: string | null } = {},
): string[] {
  const permitidos = new Set<string>(SOPORTE_ROLES)
  const ids = new Set<string>()
  for (const r of rows) {
    if (!permitidos.has(r.role)) continue
    if (!r.role_active || !r.member_active) continue
    if (opts.excludeMemberId && r.member_id === opts.excludeMemberId) continue
    ids.add(r.member_id)
  }
  return [...ids]
}

export const TIPO_NOTIFICACION_TIQUETE = 'support_ticket_new' as const
export const LINK_DE_SOPORTE = '/soporte'
const MAX_DETALLE_EN_AVISO = 140

/** Lo que dice la campana: quién lo levantó y el principio del detalle. */
export function notificacionDeTiquete(t: {
  member_name: string
  reason: string | null
  event_title?: string | null
}): { type: typeof TIPO_NOTIFICACION_TIQUETE; title: string; body: string; link: string } {
  const detalle = (t.reason ?? '').trim()
  const corto = detalle.length > MAX_DETALLE_EN_AVISO ? `${detalle.slice(0, MAX_DETALLE_EN_AVISO - 1)}…` : detalle
  const donde = t.event_title ? ` (${t.event_title})` : ''
  return {
    type: TIPO_NOTIFICACION_TIQUETE,
    title: 'Nuevo tiquete de soporte',
    body: `${t.member_name}${donde}: ${corto}`,
    link: LINK_DE_SOPORTE,
  }
}

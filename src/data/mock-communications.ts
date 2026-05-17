export type CommunicationChannel = 'whatsapp' | 'email' | 'both'
export type CommunicationStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'partial'

export type CommunicationMessage = {
  id: string
  subject: string
  body: string
  channel: CommunicationChannel
  status: CommunicationStatus
  sent_by: string
  sent_at: string | null
  created_at: string
  segment: {
    label: string
    filters: Record<string, unknown>
    total_recipients: number
  }
  stats: {
    total: number
    sent: number
    delivered: number
    failed: number
    whatsapp_sent: number
    email_sent: number
  }
  smtp_config_id: string | null
  whatsapp_config_id: string | null
}

export type MessageTemplate = {
  id: string
  name: string
  category: 'bienvenida' | 'recordatorio' | 'inscripcion' | 'cancelacion' | 'general'
  channel: CommunicationChannel
  subject: string
  body: string
  variables: string[]
  is_active: boolean
  created_at: string
  used_count: number
}

export type ChannelConfig = {
  id: string
  type: 'smtp' | 'whatsapp'
  name: string
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_from_name?: string
  smtp_from_email?: string
  wa_account_id?: string
  wa_phone_number?: string
  is_active: boolean
  is_verified: boolean
  last_verified_at: string | null
}

// ─── Channel Configs ──────────────────────────────────────────────────────────

export const MOCK_CHANNEL_CONFIGS: ChannelConfig[] = [
  {
    id: 'smtp-gmail',
    type: 'smtp',
    name: 'Gmail principal',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: 'comunicaciones@theosplace.org',
    smtp_from_name: 'Theos Place',
    smtp_from_email: 'comunicaciones@theosplace.org',
    is_active: true,
    is_verified: true,
    last_verified_at: '2026-05-10T09:00:00',
  },
  {
    id: 'smtp-corp',
    type: 'smtp',
    name: 'Correo corporativo',
    smtp_host: 'mail.theosplace.org',
    smtp_port: 465,
    smtp_user: 'admin@theosplace.org',
    smtp_from_name: 'Theos Place Admin',
    smtp_from_email: 'admin@theosplace.org',
    is_active: true,
    is_verified: false,
    last_verified_at: null,
  },
  {
    id: 'wa-business',
    type: 'whatsapp',
    name: 'WhatsApp Business Theos',
    wa_account_id: '104521839021847',
    wa_phone_number: '+506 8800-1234',
    is_active: true,
    is_verified: true,
    last_verified_at: '2026-05-12T14:30:00',
  },
]

// ─── Templates ───────────────────────────────────────────────────────────────

export const MOCK_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-bienvenida',
    name: 'Bienvenida nueva persona',
    category: 'bienvenida',
    channel: 'both',
    subject: '¡Bienvenido/a a Theos Place, {nombre}!',
    body: `Hola {nombre} 👋\n\n¡Qué alegría tenerte con nosotros! Tu perfil en Theos Place ya está listo.\n\nPodés acceder a tu perfil, ver los próximos eventos e inscribirte a estudios desde este link:\n{smart_link}\n\nSi tenés alguna pregunta, no dudes en escribirnos.\n\n¡Hasta pronto!\nEl equipo de Theos Place`,
    variables: ['{nombre}', '{smart_link}'],
    is_active: true,
    created_at: '2026-01-10T09:00:00',
    used_count: 47,
  },
  {
    id: 'tpl-recordatorio-evento',
    name: 'Recordatorio de evento',
    category: 'recordatorio',
    channel: 'whatsapp',
    subject: '',
    body: `Hola {nombre} 👋\n\nTe recordamos que mañana tenemos *{evento}* 🎉\n\n📅 {fecha}\n⏰ {hora}\n📍 {ubicacion}\n\n¡Te esperamos!`,
    variables: ['{nombre}', '{evento}', '{fecha}', '{hora}', '{ubicacion}'],
    is_active: true,
    created_at: '2026-01-15T10:00:00',
    used_count: 23,
  },
  {
    id: 'tpl-cancelacion-evento',
    name: 'Cancelación de evento',
    category: 'cancelacion',
    channel: 'both',
    subject: 'Aviso importante: {evento} cancelado',
    body: `Hola {nombre},\n\nLamentamos informarte que el evento *{evento}* programado para el {fecha} ha sido cancelado.\n\nMotivo: {motivo}\n\n{info_reembolso}\n\nGracias por tu comprensión.\nEl equipo de Theos Place`,
    variables: ['{nombre}', '{evento}', '{fecha}', '{motivo}', '{info_reembolso}'],
    is_active: true,
    created_at: '2026-01-20T11:00:00',
    used_count: 3,
  },
  {
    id: 'tpl-inscripcion-estudio',
    name: 'Confirmación de inscripción a estudio',
    category: 'inscripcion',
    channel: 'both',
    subject: 'Inscripción confirmada: {evento}',
    body: `Hola {nombre} 👋\n\nTu inscripción al estudio *{evento}* ha sido confirmada ✅\n\n📅 Inicia el: {fecha}\n⏰ Horario: {hora}\n📍 Sede: {ubicacion}\n\nTe recomendamos llegar 10 minutos antes.\n\n¡Nos vemos pronto!\nEl equipo de Theos Place`,
    variables: ['{nombre}', '{evento}', '{fecha}', '{hora}', '{ubicacion}'],
    is_active: true,
    created_at: '2026-02-05T08:30:00',
    used_count: 31,
  },
  {
    id: 'tpl-donacion-gracias',
    name: 'Agradecimiento donación',
    category: 'general',
    channel: 'email',
    subject: 'Gracias por tu donación, {nombre}',
    body: `Estimado/a {nombre},\n\nQueremos agradecerte sinceramente por tu generosa contribución a Theos Place.\n\nTu apoyo hace posible que sigamos creciendo como comunidad y llevando adelante nuestros programas de formación y eventos.\n\nPodés ver el estado de tu donación en cualquier momento desde tu perfil:\n{smart_link}\n\nCon gratitud,\nEl equipo de Theos Place`,
    variables: ['{nombre}', '{smart_link}'],
    is_active: true,
    created_at: '2026-02-14T16:00:00',
    used_count: 12,
  },
  {
    id: 'tpl-recordatorio-pago',
    name: 'Recordatorio de pago pendiente',
    category: 'recordatorio',
    channel: 'whatsapp',
    subject: '',
    body: `Hola {nombre} 👋\n\nTe recordamos que tenés un pago pendiente para *{evento}*.\n\n💰 Monto: {motivo}\n📅 Fecha límite: {fecha}\n\nPodés realizar el pago desde tu perfil:\n{smart_link}\n\n¡Gracias por tu puntualidad!`,
    variables: ['{nombre}', '{evento}', '{motivo}', '{fecha}', '{smart_link}'],
    is_active: true,
    created_at: '2026-03-01T10:00:00',
    used_count: 8,
  },
]

// ─── Messages ────────────────────────────────────────────────────────────────

export const MOCK_MESSAGES: CommunicationMessage[] = [
  {
    id: 'msg-001',
    subject: 'Recordatorio: Campamento Familiar este fin de semana',
    body: `Hola {nombre} 👋\n\nTe recordamos que mañana tenemos *Campamento Familiar* 🎉\n\n📅 Sábado 10 de mayo\n⏰ 7:00 AM\n📍 Parque La Sabana, San José\n\n¡Te esperamos!`,
    channel: 'whatsapp',
    status: 'sent',
    sent_by: 'Diana Angulo',
    sent_at: '2026-05-09T08:00:00',
    created_at: '2026-05-08T20:00:00',
    segment: {
      label: 'Inscritos al Campamento Familiar',
      filters: { event_id: 'event-camp-2026' },
      total_recipients: 312,
    },
    stats: { total: 312, sent: 304, delivered: 298, failed: 8, whatsapp_sent: 304, email_sent: 0 },
    smtp_config_id: null,
    whatsapp_config_id: 'wa-business',
  },
  {
    id: 'msg-002',
    subject: '¡Bienvenida a los nuevos miembros de abril!',
    body: `Hola {nombre} 👋\n\n¡Qué alegría tenerte con nosotros! Tu perfil en Theos Place ya está listo.\n\nPodés acceder a tu perfil desde:\n{smart_link}\n\n¡Hasta pronto!\nEl equipo de Theos Place`,
    channel: 'both',
    status: 'sent',
    sent_by: 'Diana Angulo',
    sent_at: '2026-05-01T10:00:00',
    created_at: '2026-05-01T09:30:00',
    segment: {
      label: 'Nuevos miembros de abril 2026',
      filters: { join_date_from: '2026-04-01', join_date_to: '2026-04-30' },
      total_recipients: 28,
    },
    stats: { total: 28, sent: 28, delivered: 27, failed: 0, whatsapp_sent: 16, email_sent: 12 },
    smtp_config_id: 'smtp-gmail',
    whatsapp_config_id: 'wa-business',
  },
  {
    id: 'msg-003',
    subject: 'Aviso: Charla de Finanzas Personales cancelada',
    body: `Hola {nombre},\n\nLamentamos informarte que la *Charla de Finanzas Personales* programada para el 15 de mayo ha sido cancelada.\n\nMotivo: Fuerza mayor\n\nEstaremos reprogramando la fecha próximamente.\n\nGracias por tu comprensión.\nEl equipo de Theos Place`,
    channel: 'both',
    status: 'partial',
    sent_by: 'Rodrigo Paniagua',
    sent_at: '2026-05-14T15:30:00',
    created_at: '2026-05-14T14:00:00',
    segment: {
      label: 'Inscritos a Charla de Finanzas',
      filters: { event_id: 'event-finanzas-2026' },
      total_recipients: 89,
    },
    stats: { total: 89, sent: 76, delivered: 71, failed: 13, whatsapp_sent: 44, email_sent: 32 },
    smtp_config_id: 'smtp-gmail',
    whatsapp_config_id: 'wa-business',
  },
  {
    id: 'msg-004',
    subject: 'Inicio de estudios: Grupo Heredia Norte',
    body: `Hola {nombre} 👋\n\nTu inscripción al estudio *Curso Inicial A* ha sido confirmada ✅\n\n📅 Inicia el: 20 de mayo\n⏰ Horario: Martes 7:00 PM\n📍 Sede: Heredia Norte\n\n¡Nos vemos pronto!`,
    channel: 'whatsapp',
    status: 'sent',
    sent_by: 'Diana Angulo',
    sent_at: '2026-05-13T09:00:00',
    created_at: '2026-05-13T08:30:00',
    segment: {
      label: 'Inscritos Grupo Heredia Norte — Inicial A',
      filters: { group_id: 'group-heredia-norte-a' },
      total_recipients: 18,
    },
    stats: { total: 18, sent: 18, delivered: 18, failed: 0, whatsapp_sent: 18, email_sent: 0 },
    smtp_config_id: null,
    whatsapp_config_id: 'wa-business',
  },
  {
    id: 'msg-005',
    subject: 'Encuesta de satisfacción — Charla "Identidad en Cristo"',
    body: `Hola {nombre},\n\nGracias por asistir a la charla *Identidad en Cristo* 🙏\n\nNos encantaría conocer tu experiencia. Tomá 2 minutos para completar la encuesta:\n{smart_link}\n\n¡Tu opinión nos ayuda a mejorar!\nEl equipo de Theos Place`,
    channel: 'email',
    status: 'sent',
    sent_by: 'Rodrigo Paniagua',
    sent_at: '2026-04-28T18:00:00',
    created_at: '2026-04-28T17:30:00',
    segment: {
      label: 'Asistentes a Charla Identidad en Cristo',
      filters: { event_id: 'event-identidad-2026', attended: true },
      total_recipients: 156,
    },
    stats: { total: 156, sent: 156, delivered: 149, failed: 0, whatsapp_sent: 0, email_sent: 156 },
    smtp_config_id: 'smtp-gmail',
    whatsapp_config_id: null,
  },
  {
    id: 'msg-006',
    subject: 'Donadores activos — Agradecimiento mayo',
    body: `Estimado/a {nombre},\n\nQueremos agradecerte sinceramente por tu generosa contribución a Theos Place durante este mes.\n\nTu apoyo hace posible que sigamos creciendo como comunidad.\n\nCon gratitud,\nEl equipo de Theos Place`,
    channel: 'email',
    status: 'sent',
    sent_by: 'Diana Angulo',
    sent_at: '2026-05-05T10:00:00',
    created_at: '2026-05-05T09:45:00',
    segment: {
      label: 'Donadores activos — Heredia',
      filters: { is_donor: true, sede: 'Heredia' },
      total_recipients: 203,
    },
    stats: { total: 203, sent: 199, delivered: 195, failed: 4, whatsapp_sent: 0, email_sent: 199 },
    smtp_config_id: 'smtp-gmail',
    whatsapp_config_id: null,
  },
  {
    id: 'msg-007',
    subject: 'Recordatorio: renovación membresía',
    body: `Hola {nombre} 👋\n\nTu membresía en Theos Place vence pronto.\n\nRenovala desde tu perfil para seguir disfrutando de todos los beneficios:\n{smart_link}\n\n¡Gracias por ser parte de la comunidad!`,
    channel: 'both',
    status: 'sent',
    sent_by: 'Diana Angulo',
    sent_at: '2026-04-15T09:00:00',
    created_at: '2026-04-14T20:00:00',
    segment: {
      label: 'Membresías por vencer en 30 días',
      filters: { membership_expires_in_days: 30 },
      total_recipients: 67,
    },
    stats: { total: 67, sent: 65, delivered: 63, failed: 2, whatsapp_sent: 38, email_sent: 27 },
    smtp_config_id: 'smtp-gmail',
    whatsapp_config_id: 'wa-business',
  },
  {
    id: 'msg-008',
    subject: 'Servidores del Comité de Alabanza — Reunión',
    body: `Hola {nombre} 👋\n\nTe convocamos a la reunión mensual del *Comité de Alabanza*.\n\n📅 Viernes 17 de mayo\n⏰ 7:30 PM\n📍 Sala de reuniones — Sede Central\n\n¡Contamos con tu presencia!`,
    channel: 'whatsapp',
    status: 'sent',
    sent_by: 'Rodrigo Paniagua',
    sent_at: '2026-05-13T12:00:00',
    created_at: '2026-05-13T11:30:00',
    segment: {
      label: 'Servidores activos — Comité de Alabanza',
      filters: { committee: 'Alabanza', service_status: 'active' },
      total_recipients: 24,
    },
    stats: { total: 24, sent: 24, delivered: 24, failed: 0, whatsapp_sent: 24, email_sent: 0 },
    smtp_config_id: null,
    whatsapp_config_id: 'wa-business',
  },
  {
    id: 'msg-009',
    subject: 'Campaña verano — invitación especial',
    body: `Hola {nombre} 👋\n\nTenemos algo especial preparado para este verano.\n\nTe invitamos a nuestra *Campaña de Verano 2026* 🌟\n\nMás detalles próximamente en:\n{smart_link}`,
    channel: 'both',
    status: 'draft',
    sent_by: 'Diana Angulo',
    sent_at: null,
    created_at: '2026-05-16T17:00:00',
    segment: {
      label: 'Todos los miembros activos',
      filters: { status: 'active' },
      total_recipients: 1247,
    },
    stats: { total: 0, sent: 0, delivered: 0, failed: 0, whatsapp_sent: 0, email_sent: 0 },
    smtp_config_id: 'smtp-gmail',
    whatsapp_config_id: 'wa-business',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getDeliveryRate(msg: CommunicationMessage): number {
  if (msg.stats.total === 0) return 0
  return Math.round((msg.stats.delivered / msg.stats.total) * 100)
}

// Notificaciones internas (tabla internal_notifications, migración 041).

export type InternalNotificationType =
  | 'study_relocation_request'
  | 'study_interest_request'
  | 'study_request_assigned'
  // Tipos legacy (filas previas a la consolidación de la migración 050):
  | 'study_join_request'
  | 'study_new_group_request'
  | 'finance_scholarship_request'
  | 'finance_refund_request'
  | 'leader_absent_alert'
  | 'broadcast'

export type InternalNotification = {
  id: string
  recipient_member_id: string
  type: InternalNotificationType
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

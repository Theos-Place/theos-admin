// Notificaciones internas (tabla internal_notifications, migración 041).

export type InternalNotificationType =
  | 'study_relocation_request'
  | 'study_join_request'
  | 'study_new_group_request'

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

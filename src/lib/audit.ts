import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'APPROVE' | 'REJECT' | 'MERGE' | 'ROLE_CHANGE' | 'DEACTIVATE'

/**
 * Registro de auditoría app-level CON actor. Los triggers de la BD registran
 * actor_id = NULL (todo va por service role, auth.uid() es NULL), así que las
 * mutaciones sensibles insertan su registro acá con el auth user id del guard
 * (ctx.userId). Best-effort: un fallo de auditoría se loguea pero nunca
 * bloquea la operación.
 */
export async function logAudit(input: {
  /** auth.users.id — viene de auth.ctx.userId en los handlers. */
  actorUserId: string
  action: AuditAction
  entityType: string
  entityId?: string | null
  oldData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('audit_log').insert({
      actor_id: input.actorUserId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      old_data: (input.oldData ?? null) as Json,
      new_data: (input.newData ?? null) as Json,
    })
    if (error) console.error('logAudit:', error.message)
  } catch (e) {
    console.error('logAudit:', e)
  }
}

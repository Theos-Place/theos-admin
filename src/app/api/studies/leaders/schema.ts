import { z } from 'zod'
import { LEADER_STATUSES } from '@/lib/studies/leader-admin-status'

// Validación runtime del body de dirigentes (POST de creación y PUT de
// edición). El input va directo a insert/update de `study_leaders` con service
// role, así que `.strict()` corta el mass assignment (B11 auditoría).
export const leaderWriteSchema = z
  .object({
    member_id: z.string().trim().min(1),
    zone_preference: z.array(z.string().trim().min(1)).optional(),
    availability_status: z.enum(LEADER_STATUSES).optional(),
    is_active: z.boolean().optional(),
    qualified_study_codes: z.array(z.string().trim().min(1)).optional(),
  })
  .strict()

export const leaderUpdateSchema = leaderWriteSchema.partial()

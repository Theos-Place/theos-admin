import { z } from 'zod'

// Validación runtime del body de planes de estudio (POST de creación y PUT de
// edición). El input va directo a insert/update de `study_plans` con service
// role, así que `.strict()` corta el mass assignment (B11 auditoría).
export const planWriteSchema = z
  .object({
    name: z.string().trim().min(1),
    code: z.string().trim().nullish(),
    description: z.string().trim().nullish(),
    level: z.enum(['niveles', 'etapa_inicial', 'etapa_intermedia', 'campanas']),
    cost: z.number().min(0).optional(),
    duration_weeks: z.number().int().min(0).nullish(),
    max_students: z.number().int().min(0).nullish(),
    requires_donor: z.boolean().optional(),
    requires_attendance: z.boolean().optional(),
    requires_payment: z.boolean().optional(),
    requires_grade: z.boolean().optional(),
    requires_server: z.boolean().optional(),
    requires_bus_talk: z.boolean().optional(),
    requires_invitation: z.boolean().optional(),
    auto_promote: z.boolean().optional(),
    prerequisite_code: z.string().trim().nullish(),
    next_study_code: z.string().trim().nullish(),
    min_attendance_pct: z.number().min(0).max(100).optional(),
    is_active: z.boolean().optional(),
    difficulty: z.string().trim().nullish(),
    commitments: z.string().trim().nullish(),
    mentor_id: z.string().trim().min(1).nullish(),
  })
  .strict()

export const planUpdateSchema = planWriteSchema.partial()

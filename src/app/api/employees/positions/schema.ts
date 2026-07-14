import { z } from 'zod'

// Validación runtime del body de puestos pagados (POST y PUT). El input va
// directo a insert/update de `paid_positions` con service role, así que
// `.strict()` corta el mass assignment (B11 auditoría).
export const positionWriteSchema = z
  .object({
    name: z.string().trim().min(1),
    committee_id: z.string().trim().min(1).nullish(),
    description: z.string().trim().nullish(),
    contract_type: z.enum(['planilla', 'servicios_profesionales']).nullish(),
    salary_min: z.number().min(0).nullish(),
    salary_max: z.number().min(0).nullish(),
    is_active: z.boolean().optional(),
  })
  .strict()

export const positionUpdateSchema = positionWriteSchema.partial()

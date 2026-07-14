import { z } from 'zod'

// Validación runtime de vacantes (POST de creación y PUT de edición). El input
// se esparce entero al insert/update de `vacancies` con service role, así que
// `.strict()` corta el mass assignment (B11 auditoría).
export const vacancyWriteSchema = z
  .object({
    committee_id: z.string().trim().min(1),
    position_id: z.string().trim().min(1).nullish(),
    title: z.string().trim().min(1),
    position: z.string().trim().nullish(),
    description: z.string().trim().nullish(),
    functions: z.array(z.string().trim().min(1)).optional(),
    schedule: z.string().trim().nullish(),
    commitment: z.string().trim().nullish(),
    slots_total: z.number().int().min(1).max(1000).optional(),
    status: z
      .enum(['draft', 'published', 'filled', 'closed', 'creado', 'enviado_lider', 'aprobado', 'denegado'])
      .optional(),
    expires_at: z.string().trim().min(1).nullish(),
    location: z.string().trim().nullish(),
    notes: z.string().trim().nullish(),
    is_featured: z.boolean().optional(),
  })
  .strict()

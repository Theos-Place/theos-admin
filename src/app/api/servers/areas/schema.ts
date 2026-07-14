import { z } from 'zod'

// Validación runtime del body de áreas/comités (POST de creación y PUT de
// edición). createArea/updateArea esparcen el input entero a `areas` con
// service role, así que `.strict()` corta el mass assignment (B11 auditoría).
export const areaCreateSchema = z
  .object({
    name: z.string().trim().min(1),
    area_type: z.enum(['area', 'committee']),
    description: z.string().trim().nullish(),
    parent_id: z.string().trim().min(1).nullish(),
    leader_id: z.string().trim().min(1).nullish(),
  })
  .strict()

// El PUT no permite cambiar area_type, pero sí activar/desactivar.
export const areaUpdateSchema = areaCreateSchema
  .omit({ area_type: true })
  .extend({ is_active: z.boolean() })
  .partial()

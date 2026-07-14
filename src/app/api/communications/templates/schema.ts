import { z } from 'zod'

// Validación runtime del body de plantillas (POST y PUT). El input va directo
// a insert/update de `message_templates` con service role, así que `.strict()`
// corta el mass assignment (B11 auditoría): is_system/system_key nunca entran
// por acá (además la query los descarta en updates).
export const templateWriteSchema = z
  .object({
    name: z.string().trim().min(1),
    category: z.string().trim().nullish(),
    channel: z.enum(['interna', 'whatsapp', 'email', 'both']),
    subject: z.string().trim().nullish(),
    // El body puede ser HTML y estar vacío en borradores; sin min(1) a propósito.
    body: z.string(),
    body_format: z.enum(['text', 'html']).optional(),
    variables: z.unknown().optional(),
    available_variables: z.unknown().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()

export const templateUpdateSchema = templateWriteSchema.partial()

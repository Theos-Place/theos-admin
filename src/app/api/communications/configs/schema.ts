import { z } from 'zod'

// Validación runtime del body de configuraciones de canal (POST y PUT).
// El input va directo a insert/update de `channel_configs` con service role,
// así que `.strict()` corta el mass assignment (B11 auditoría).
export const configWriteSchema = z
  .object({
    type: z.enum(['smtp', 'whatsapp']),
    name: z.string().trim().min(1),
    smtp_host: z.string().trim().nullish(),
    smtp_port: z.number().int().min(1).max(65535).nullish(),
    smtp_user: z.string().trim().nullish(),
    smtp_from_name: z.string().trim().nullish(),
    smtp_from_email: z.string().trim().nullish(),
    wa_account_id: z.string().trim().nullish(),
    wa_phone_number: z.string().trim().nullish(),
    is_active: z.boolean().optional(),
  })
  .strict()

export const configUpdateSchema = configWriteSchema.partial()
